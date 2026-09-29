#!/usr/bin/env bash
# Локальная машина владельца (решение 29.09): раз в сутки забрать свежий дамп прода, хранить
# не больше 7 дней, заодно проверить здоровье прода. Запускается user-таймером systemd
# (deploy/local/recipe-backup-pull.timer, Persistent=true — если машина была выключена,
# догонит при включении). Параметры — ~/.config/recipe/backup.env (не в git):
#   RECIPE_PROD_SSH=root@<сервер>   RECIPE_SITE_URL=https://example.org
#   RECIPE_BACKUP_DIR=$HOME/backups/recipe (по умолчанию)
set -euo pipefail
CONF="${RECIPE_BACKUP_CONF:-$HOME/.config/recipe/backup.env}"
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"
HOST="${RECIPE_PROD_SSH:?RECIPE_PROD_SSH не задан в $CONF}"
SITE="${RECIPE_SITE_URL:?RECIPE_SITE_URL не задан в $CONF}"
DEST="${RECIPE_BACKUP_DIR:-$HOME/backups/recipe}"
KEEP=7
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15)
problems=()

mkdir -p "$DEST"
chmod 700 "$DEST"

# 1. Свежий дамп.
latest=$("${SSH[@]}" "$HOST" 'ls -1t /opt/recipe/backups/recipe_*.dump 2>/dev/null | head -1' || true)
if [ -z "$latest" ]; then
  problems+=("на сервере нет дампов")
else
  name=$(basename "$latest")
  if [ ! -f "$DEST/$name" ]; then
    scp -q -o BatchMode=yes "$HOST:$latest" "$DEST/$name.part"
    mv "$DEST/$name.part" "$DEST/$name"
    chmod 600 "$DEST/$name"
  fi
fi
find "$DEST" -name 'recipe_*.dump' -mtime +$((KEEP - 1)) -delete
ls -1t "$DEST"/recipe_*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
rm -f "$DEST"/*.part

# 2. Проверки прода: сайт готов, бэкап свежий (≤ 26 ч), таймер деплоя жив (≤ 15 мин), место есть.
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$SITE/api/health/ready" 2>/dev/null) || true
code=${code:-000}
[ "$code" = 200 ] || problems+=("ready ответил $code")
now=$(date +%s)
read -r backup_ts deploy_ts free_kb < <("${SSH[@]}" "$HOST" \
  'echo "$(date -r /opt/recipe/state/backup-heartbeat +%s 2>/dev/null || echo 0) $(date -r /opt/recipe/state/heartbeat +%s 2>/dev/null || echo 0) $(df --output=avail / | tail -1)"' || echo "0 0 0")
[ $((now - backup_ts)) -le $((26 * 3600)) ] || problems+=("дамп старше 26 часов")
[ $((now - deploy_ts)) -le $((15 * 60)) ] || problems+=("таймер деплоя молчит больше 15 минут")
[ "${free_kb:-0}" -ge $((5 * 1024 * 1024)) ] || problems+=("на сервере меньше 5 ГБ свободно")

count=$(ls -1 "$DEST"/recipe_*.dump 2>/dev/null | wc -l)
if [ ${#problems[@]} -gt 0 ]; then
  joined=$(printf '%s; ' "${problems[@]}")
  printf '[%s] ПРОБЛЕМЫ: %s(локальных дампов: %s)\n' "$(date -Is)" "$joined" "$count" >&2
  exit 1
fi
echo "[$(date -Is)] OK: дамп ${name:-?}, локальных дампов: $count"
