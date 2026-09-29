#!/bin/sh
# Локальная и CI-база: роли при первом старте контейнера. Повторно: pnpm db:roles.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v dbname="$POSTGRES_DB" \
  -v app_password="$RECIPE_APP_PASSWORD" \
  -v migrator_password="$RECIPE_MIGRATOR_PASSWORD" \
  -f /recipe/recipe-roles.sql
