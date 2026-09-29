#!/usr/bin/env bash
# Канонная копия серверного автодеплоя книги рецептов (ADR-0014). На сервере живёт в
# /usr/local/bin/recipe-deploy.sh, запускается recipe-deploy.timer каждые 5 минут.
#
# Модель sup2 (сервер сам забирает релиз, миграции до swap, smoke по коммиту, откат), но образ
# на сервере НЕ собирается: CI публикует уже проверенный образ в GHCR (:<sha> и :stable).
#
#   recipe-deploy.sh                      — обычный тик: есть новый :stable → выкатить
#   recipe-deploy.sh --force              — выкатить :stable, даже если он в карантине
#   recipe-deploy.sh --candidate <ref>    — выкатить указанный образ (проверка откатов)
#
# Параметры (домены, email ACME, сеть прокси) — root-only /etc/recipe/deploy.env, не в git.
set -euo pipefail

# 🔴 `9>&-` у каждого docker run обязателен (грабля sup2 17.08): иначе fd блокировки наследует
# процесс контейнера, блокировка висит вечно, и следующие тики молча пишут «already running».
exec 9>/var/lock/recipe-deploy.lock
flock -n 9 || { echo "deploy already running, skip"; exit 0; }

CONF=/etc/recipe/deploy.env
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"
IMAGE="${RECIPE_IMAGE:-ghcr.io/julia15535/recipe}"
CHANNEL="${RECIPE_CHANNEL:-stable}"
HOSTS="${RECIPE_HOSTS:?RECIPE_HOSTS не задан в $CONF}"
ACME_EMAIL="${RECIPE_ACME_EMAIL:?RECIPE_ACME_EMAIL не задан в $CONF}"
PROXY_NET="${RECIPE_PROXY_NETWORK:-webproxy}"
APP_NET=recipe-net
WEB=recipe-web
CAND=recipe-web-candidate
STATE=/opt/recipe/state
mkdir -p "$STATE"

log() { echo "[$(date -Is)] $*"; }
heartbeat() { date -Is > "$STATE/heartbeat"; }

MODE=tick
TARGET=""
case "${1:-}" in
  "") ;;
  --force) MODE=force ;;
  --candidate) MODE=candidate; TARGET="${2:?укажи образ: --candidate <image@sha256:...>}" ;;
  *) echo "usage: $0 [--force | --candidate <image-ref>]" >&2; exit 2 ;;
esac

# Точка отката фиксируется ДО любого pull: ID образа работающего контейнера.
ROLLBACK_ID=$(docker inspect -f '{{.Image}}' "$WEB" 2>/dev/null || true)

if [ "$MODE" != candidate ]; then
  if ! docker pull -q "$IMAGE:$CHANNEL" >/dev/null 2>&1; then
    log "GHCR недоступен — прод не трогаем"; heartbeat; exit 0
  fi
  TARGET=$(docker inspect -f '{{index .RepoDigests 0}}' "$IMAGE:$CHANNEL")
elif ! docker image inspect "$TARGET" >/dev/null 2>&1; then
  docker pull -q "$TARGET" >/dev/null
fi
TARGET_ID=$(docker inspect -f '{{.Id}}' "$TARGET")
REVISION=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$TARGET")

running=$(docker inspect -f '{{.State.Running}}' "$WEB" 2>/dev/null || echo false)
if [ "$MODE" = tick ] && [ "$TARGET_ID" = "$ROLLBACK_ID" ] && [ "$running" = true ]; then
  heartbeat; exit 0
fi
# Карантин: релиз, который уже не прошёл smoke, не ставим повторно каждые 5 минут.
if [ "$MODE" = tick ] && grep -qxF "$TARGET_ID" "$STATE/failed-images" 2>/dev/null; then
  heartbeat; exit 0
fi

log "выкатываем $TARGET (revision ${REVISION:-?})"

# Общие ограничения: сайт не должен отнимать ресурсы у соседних сервисов хоста;
# при нехватке памяти ядро первым убивает наш контейнер (oom-score-adj).
HARDEN=(--read-only --tmpfs /tmp:size=64m --cap-drop=ALL --security-opt no-new-privileges --init
        --log-driver json-file --log-opt max-size=10m --log-opt max-file=3)
# shellcheck disable=SC2054 # запятые — это опции tmpfs, а не разделители массива
WEB_LIMITS=(--cpus=.25 --memory=384m --memory-swap=384m --pids-limit=128 --oom-score-adj=600
            --tmpfs /app/.next/cache:size=128m,uid=10001,gid=10001)

ready_sha() { # $1 = контейнер → печатает version из /api/health/ready, если ok
  docker exec "$1" node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.ok)console.log(j.version)}).catch(()=>{})" 2>/dev/null || true
}

wait_ready() { # $1 = контейнер, $2 = ожидаемый SHA (пусто — любой)
  local sha
  for _ in $(seq 1 30); do
    sha=$(ready_sha "$1")
    if [ -n "$sha" ] && { [ -z "$2" ] || [ "$sha" = "$2" ]; }; then return 0; fi
    sleep 2
  done
  return 1
}

run_web() { # $1 = имя, $2 = образ, $3 = "proxy" → подключить к прокси
  local extra=()
  if [ "${3:-}" = proxy ]; then
    extra=(--network "$PROXY_NET" -e VIRTUAL_HOST="$HOSTS" -e VIRTUAL_PORT=3000
           -e LETSENCRYPT_HOST="$HOSTS" -e LETSENCRYPT_EMAIL="$ACME_EMAIL")
  fi
  docker run -d --name "$1" --restart unless-stopped --network "$APP_NET" "${extra[@]}" \
    --env-file /opt/recipe/web.env "${HARDEN[@]}" "${WEB_LIMITS[@]}" "$2" 9>&- >/dev/null
}

# 1. Миграции — до swap, одноразовым контейнером с отдельными учётными данными (web их не видит).
#    Провал: старый сайт продолжает работать; Drizzle откатывает транзакцию, следующий тик повторит.
if ! docker run --rm --name recipe-migrate --network "$APP_NET" --env-file /opt/recipe/migrate.env \
     "${HARDEN[@]}" --cpus=.10 --memory=256m --memory-swap=256m --pids-limit=64 --oom-score-adj=900 \
     "$TARGET" node migrator/migrate.mjs 9>&-; then
  log "миграция упала — прод остаётся на прежней версии"; heartbeat; exit 1
fi

# 2. Кандидат поднимается только во внутренней сети: упавший на старте образ до прокси не доходит.
docker rm -f "$CAND" >/dev/null 2>&1 || true
if ! run_web "$CAND" "$TARGET" || ! wait_ready "$CAND" "$REVISION"; then
  log "кандидат не поднялся — прод не трогаем, образ в карантин"
  docker logs --tail 200 "$CAND" > "$STATE/failed-$(date +%s).log" 2>&1 || true
  docker rm -f "$CAND" >/dev/null 2>&1 || true
  echo "$TARGET_ID" >> "$STATE/failed-images"; heartbeat; exit 1
fi
docker rm -f "$CAND" >/dev/null

# 3. Swap. Любая ошибка отсюда — единый откат на образ, зафиксированный в начале.
swap_to() { # $1 = образ, $2 = ожидаемый SHA
  docker stop -t 20 "$WEB" >/dev/null 2>&1 || true
  docker rm -f "$WEB" >/dev/null 2>&1 || true
  run_web "$WEB" "$1" proxy || return 1
  wait_ready "$WEB" "$2" || return 1
}

if ! swap_to "$TARGET" "$REVISION"; then
  log "SMOKE FAILED ($REVISION) — откат"
  docker logs --tail 200 "$WEB" > "$STATE/failed-$(date +%s).log" 2>&1 || true
  echo "$TARGET_ID" >> "$STATE/failed-images"
  if [ -n "$ROLLBACK_ID" ] && swap_to "$ROLLBACK_ID" ""; then
    log "откат выполнен"
  else
    log "🔴 ОТКАТ НЕ УДАЛСЯ — сайт недоступен, нужен человек"
  fi
  heartbeat; exit 1
fi

# 4. Уборка: только наши образы, оставляем текущий и предыдущий. Глобальных prune нет — сервер общий.
docker images "$IMAGE" --format '{{.ID}}' | sort -u | while read -r id; do
  case "$TARGET_ID $ROLLBACK_ID" in *"$id"*) continue ;; esac
  docker image rm "$id" >/dev/null 2>&1 || true
done
echo "$TARGET_ID" > "$STATE/current-image"
log "выкачено OK: $REVISION"
heartbeat
