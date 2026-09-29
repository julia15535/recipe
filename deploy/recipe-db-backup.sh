#!/usr/bin/env bash
# Ежедневный дамп БД на сервере (ADR-0014, решение владельца 29.09): формат custom (-Fc),
# храним не больше 7 дней. Копию раз в сутки забирает локальная машина владельца
# (deploy/local/recipe-backup-pull.sh). На сервере: /usr/local/bin/recipe-db-backup.sh.
set -euo pipefail
DIR=/opt/recipe/backups
KEEP=7
mkdir -p "$DIR" /opt/recipe/state
chmod 700 "$DIR"

file="$DIR/recipe_$(date +%Y%m%d_%H%M%S).dump"
docker exec recipe-db pg_dump -U postgres -d recipe -Fc > "$file.part"
mv "$file.part" "$file"
chmod 600 "$file"

# Не больше KEEP файлов и не старше KEEP дней.
find "$DIR" -name 'recipe_*.dump' -mtime +$((KEEP - 1)) -delete
ls -1t "$DIR"/recipe_*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f
rm -f "$DIR"/*.part

date -Is > /opt/recipe/state/backup-heartbeat
echo "[$(date -Is)] backup OK: $(basename "$file") ($(du -h "$file" | cut -f1))"
