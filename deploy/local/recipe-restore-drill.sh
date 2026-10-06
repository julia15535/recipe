#!/usr/bin/env bash
# Еженедельная проверка, что бэкап реально восстанавливается (ADR-0014): последний локальный дамп →
# временный Postgres 17 → pg_restore --exit-on-error → журнал миграций на месте → контейнер удаляется.
set -euo pipefail
CONF="${RECIPE_BACKUP_CONF:-$HOME/.config/recipe/backup.env}"
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"
DEST="${RECIPE_BACKUP_DIR:-$HOME/backups/recipe}"
NAME=recipe-restore-drill

latest=$(ls -1t "$DEST"/recipe_*.dump 2>/dev/null | head -1 || true)
[ -n "$latest" ] || { echo "[$(date -Is)] нет локальных дампов" >&2; exit 1; }

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run -d --name "$NAME" --memory=512m -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=recipe \
  -v "$latest:/drill.dump:ro" postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres -d recipe >/dev/null 2>&1 && break; sleep 1; done

started=$(date +%s)
docker exec "$NAME" pg_restore --exit-on-error --no-owner --no-privileges -U postgres -d recipe /drill.dump
migrations=$(docker exec "$NAME" psql -U postgres -d recipe -tAc 'select count(*) from drizzle.__drizzle_migrations')
[ "${migrations:-0}" -ge 1 ] || { echo "[$(date -Is)] в восстановленной базе нет журнала миграций" >&2; exit 1; }
# Фото блюд и статей живут в базе (ADR-0028, ADR-0034): у каждого фото есть все файлы показа; байты — целые JPEG
# (начало FFD8FF и конец FFD9) или WebP (RIFF…WEBP, длина в заголовке совпадает с размером) — обрезанный файл
# проверку не пройдёт. Таблицы статей появились позже (миграция 0010) — в старом бэкапе их может не быть.
check_photos() { # $1 — таблица файлов, $2 — таблица фото; печатает «N (размер)» или «нет таблицы»
  if [ "$(docker exec "$NAME" psql -U postgres -d recipe -tAc "select to_regclass('public.$1') is not null")" != t ]; then
    echo "нет таблицы"
    return
  fi
  broken=$(docker exec "$NAME" psql -U postgres -d recipe -tAc "
    select count(*) from $1 where not (
      (content_type = 'image/jpeg' and substring(bytes from 1 for 3) = '\\xffd8ff'::bytea
        and substring(bytes from octet_length(bytes) - 1 for 2) = '\\xffd9'::bytea) or
      (content_type = 'image/webp' and substring(bytes from 1 for 4) = 'RIFF'::bytea and substring(bytes from 9 for 4) = 'WEBP'::bytea
        and get_byte(bytes, 4) + get_byte(bytes, 5) * 256 + get_byte(bytes, 6) * 65536 + get_byte(bytes, 7) * 16777216
          = octet_length(bytes) - 8))")
  incomplete=$(docker exec "$NAME" psql -U postgres -d recipe -tAc "
    select count(*) from $2 p where (select count(*) from $1 f
      where f.photo_id = p.id and f.name in ('source', 'w480', 'og')) <> 3")
  [ "$broken" = 0 ] && [ "$incomplete" = 0 ] || { echo "[$(date -Is)] фото в бэкапе ($1) испорчены: файлов $broken, неполных $incomplete" >&2; exit 1; }
  docker exec "$NAME" psql -U postgres -d recipe -tAc "select count(distinct photo_id) || ' (' || pg_size_pretty(coalesce(sum(octet_length(bytes)), 0)) || ')' from $1"
}
photos=$(check_photos recipe_photo_files recipe_photos) || exit 1
article_photos=$(check_photos article_photo_files article_photos) || exit 1
echo "[$(date -Is)] restore OK: $(basename "$latest"), миграций: $migrations, фото рецептов: $photos, статей: $article_photos, за $(( $(date +%s) - started )) с"
