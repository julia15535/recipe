# deploy/ — прод книги рецептов (канонные копии)

Как код попадает на сайт и как с этим обращаться (ADR-0014, `.memory_bank/core/deployment.md`).
Адрес сервера и доступы — не здесь: `.memory_bank/_secrets/ACCESS.md` (вне git, репозиторий публичный).

## Как устроено
1. CI (`.github/workflows/ci.yml`) собирает образ **один раз**, прогоняет на нём миграции, тесты БД,
   e2e и отказы, публикует `ghcr.io/julia15535/recipe:<sha>` и двигает `:stable`.
2. Сервер каждые 5 минут (`recipe-deploy.timer` → `/usr/local/bin/recipe-deploy.sh`) смотрит `:stable`:
   - новый образ → миграция одноразовым контейнером (`/opt/recipe/migrate.env`);
   - кандидат поднимается только во внутренней сети `recipe-net` и должен ответить `ready` с нужным SHA;
   - swap: старый `recipe-web` останавливается, новый подключается к общему прокси;
   - `ready` с нужным SHA → готово; иначе откат на образ, работавший до деплоя, новый — в карантин.
3. Что происходит при сбое:
   | Сбой | Что делает скрипт |
   |------|-------------------|
   | GHCR недоступен | ничего, прод не трогается |
   | упала миграция | прод на прежней версии; повтор на следующем тике (миграции Drizzle — в транзакции) |
   | кандидат не поднялся | прод не трогается; образ в карантин (`/opt/recipe/state/failed-images`) |
   | новый сайт не прошёл smoke после swap | откат на прежний образ (при нужде — pull из GHCR), новый — в карантин |

## Разовая настройка сервера (сделано 29.09.2026)
Всё — ресурсы `recipe-*`; соседние контейнеры, прокси и файрвол не трогаем.
```bash
mkdir -p /opt/recipe/{db,backups,state} /etc/recipe && chmod 700 /opt/recipe/{backups,state} /etc/recipe
# Секреты: генерируются на сервере, файлы 0600, наружу не печатаются.
#   /opt/recipe/db.env       POSTGRES_USER=postgres, POSTGRES_PASSWORD, POSTGRES_DB=recipe
#   /opt/recipe/roles.env    RECIPE_APP_PASSWORD, RECIPE_MIGRATOR_PASSWORD
#   /opt/recipe/web.env      DATABASE_URL (recipe_app@recipe-db), SITE_URL, SITE_INDEXABLE=false
#   /opt/recipe/migrate.env  MIGRATION_DATABASE_URL (recipe_migrator@recipe-db)
#   /etc/recipe/deploy.env   см. deploy.env.example (домены, email ACME, сеть прокси)
# GIT_SHA в web.env НЕ задавать: он зашит в образ, и smoke сверяет именно его.
docker network create recipe-net
docker run -d --name recipe-db --restart unless-stopped --network recipe-net \
  --cpus=.20 --memory=512m --memory-swap=512m --pids-limit=128 --oom-score-adj=300 --shm-size=128m \
  --env-file /opt/recipe/db.env -v /opt/recipe/db:/var/lib/postgresql/data \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  postgres:17-alpine postgres -c shared_buffers=128MB -c effective_cache_size=384MB -c work_mem=2MB \
    -c maintenance_work_mem=32MB -c autovacuum_work_mem=32MB -c max_connections=20 \
    -c max_parallel_workers_per_gather=0 -c jit=off -c temp_file_limit=128MB
# Роли (идемпотентно; повторять при изменении recipe-roles.sql):
docker exec -i --env-file /opt/recipe/roles.env recipe-db sh -c \
  'psql -q -v ON_ERROR_STOP=1 -U postgres -d recipe -v dbname=recipe \
     -v app_password="$RECIPE_APP_PASSWORD" -v migrator_password="$RECIPE_MIGRATOR_PASSWORD" -f -' \
  < recipe-roles.sql
install -m 755 recipe-deploy.sh recipe-db-backup.sh /usr/local/bin/
install -m 644 recipe-deploy.{service,timer} recipe-db-backup.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now recipe-db-backup.timer recipe-deploy.timer
```
HTTPS: общий `acme-companion` сам выпускает сертификат Let's Encrypt по `LETSENCRYPT_HOST` контейнера
(один SAN на apex + www) и сам продлевает (проверка раз в час, продление за ~30 дней до истечения).

**Перед изменениями, касающимися прокси** (новые домены, сети): `docker exec nginx-proxy nginx -t`,
никто другой не занял наши домены (`VIRTUAL_HOST` у контейнеров), эталон ответа соседнего сайта до и
после (`curl -s -o /dev/null -w '%{http_code} %{size_download}'` + hash тела).

## Повседневное
```bash
journalctl -u recipe-deploy --since today          # что делал автодеплой
/usr/local/bin/recipe-deploy.sh --force            # выкатить :stable, даже если он в карантине
/usr/local/bin/recipe-deploy.sh --candidate <ref>  # выкатить конкретный образ (проверка откатов)
: > /opt/recipe/state/failed-images                # снять карантин
docker logs --tail 200 recipe-web                  # логи сайта (JSON, телефоны/токены замаскированы)
cat /opt/recipe/state/heartbeat                    # таймер деплоя жив (обновляется каждый тик)
```

## Бэкап и восстановление
- Сервер: `recipe-db-backup.timer` раз в сутки → `/opt/recipe/backups/recipe_*.dump` (`pg_dump -Fc`),
  не больше 7 файлов и не старше 7 дней.
- Локальная машина владельца: `deploy/local/` — `recipe-backup-pull` (раз в сутки забрать свежий
  дамп, ≤ 7 дней, проверить ready / свежесть дампа / таймер деплоя / место) и `recipe-restore-drill`
  (раз в неделю восстановить последний дамп во временный Postgres 17). Установка:
  ```bash
  mkdir -p ~/.config/recipe ~/.config/systemd/user
  # ~/.config/recipe/backup.env: RECIPE_PROD_SSH=root@<сервер>, RECIPE_SITE_URL=https://mycoruja.food
  ln -sf "$PWD"/deploy/local/recipe-*.{service,timer} ~/.config/systemd/user/
  systemctl --user daemon-reload && systemctl --user enable --now recipe-backup-pull.timer recipe-restore-drill.timer
  loginctl enable-linger "$USER"   # таймеры работают и без открытой сессии
  ```
- Восстановление прода из дампа (сайт на время остановить):
  ```bash
  docker stop recipe-web
  docker exec -i recipe-db pg_restore --clean --if-exists -U postgres -d recipe < /opt/recipe/backups/<файл>.dump
  docker start recipe-web
  ```
