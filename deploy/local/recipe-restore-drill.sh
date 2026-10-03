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
# Фото блюд живут в базе (ADR-0028): у каждого фото есть все файлы показа; байты — целые JPEG (начало FFD8FF и конец
# FFD9) или WebP (RIFF…WEBP, длина в заголовке совпадает с размером) — обрезанный файл проверку не пройдёт.
photos="нет таблицы"
if [ "$(docker exec "$NAME" psql -U postgres -d recipe -tAc "select to_regclass('public.recipe_photo_files') is not null")" = t ]; then
  broken=$(docker exec "$NAME" psql -U postgres -d recipe -tAc "
    select count(*) from recipe_photo_files where not (
      (content_type = 'image/jpeg' and substring(bytes from 1 for 3) = '\\xffd8ff'::bytea
        and substring(bytes from octet_length(bytes) - 1 for 2) = '\\xffd9'::bytea) or
      (content_type = 'image/webp' and substring(bytes from 1 for 4) = 'RIFF'::bytea and substring(bytes from 9 for 4) = 'WEBP'::bytea
        and get_byte(bytes, 4) + get_byte(bytes, 5) * 256 + get_byte(bytes, 6) * 65536 + get_byte(bytes, 7) * 16777216
          = octet_length(bytes) - 8))")
  incomplete=$(docker exec "$NAME" psql -U postgres -d recipe -tAc "
    select count(*) from recipe_photos p where (select count(*) from recipe_photo_files f
      where f.photo_id = p.id and f.name in ('source', 'w480', 'og')) <> 3")
  [ "$broken" = 0 ] && [ "$incomplete" = 0 ] || { echo "[$(date -Is)] фото в бэкапе испорчены: файлов $broken, неполных $incomplete" >&2; exit 1; }
  photos=$(docker exec "$NAME" psql -U postgres -d recipe -tAc "select count(*) || ' (' || pg_size_pretty(coalesce(sum(octet_length(bytes)), 0)) || ')' from recipe_photo_files f join recipe_photos p on p.id = f.photo_id where f.name = 'w480'")
fi
echo "[$(date -Is)] restore OK: $(basename "$latest"), миграций: $migrations, фото: $photos, за $(( $(date +%s) - started )) с"
