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
echo "[$(date -Is)] restore OK: $(basename "$latest"), миграций: $migrations, за $(( $(date +%s) - started )) с"
