#!/usr/bin/env bash
# Печатает git-ревизию образа ghcr.io/<repo>:<tag> (метка org.opencontainers.image.revision).
# Анонимно через API реестра — пакет публичный. Пусто/ошибка — образа ещё нет.
# Нужен CI: «менялся ли код» на main считаем от реально опубликованного релиза, а не от прошлого
# push — иначе отменённый или пропущенный прогон «теряет» код до следующего изменения.
set -euo pipefail
repo="${1:-${GITHUB_REPOSITORY:?укажи owner/repo}}"
repo="${repo,,}"
tag="${2:-stable}"
accept='application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'

token=$(curl -fsS "https://ghcr.io/token?scope=repository:${repo}:pull" | jq -r .token)
get() { curl -fsSL -H "Authorization: Bearer $token" -H "Accept: $accept" "https://ghcr.io/v2/${repo}/$1"; }

manifest=$(get "manifests/${tag}")
if jq -e '.manifests' >/dev/null <<<"$manifest"; then
  digest=$(jq -r '[.manifests[] | select(.platform.os == "linux" and .platform.architecture == "amd64")][0].digest' <<<"$manifest")
  manifest=$(get "manifests/${digest}")
fi
get "blobs/$(jq -r .config.digest <<<"$manifest")" | jq -r '.config.Labels["org.opencontainers.image.revision"] // empty'
