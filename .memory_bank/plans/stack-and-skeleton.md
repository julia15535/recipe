---
workstream: platform
slug: stack-and-skeleton
title: Стек и каркас — стек, каркас Next.js + БД + RU/EN + тесты + CI/CD до прода mycoruja.food
status: in_progress
created: 2026-09-27
updated: 2026-09-29
completed:
owner_decision_required: доступ igortsk123 к julia15535/recipe (фазы 2–4); правило авторежима на сервер (фаза 4); канал алертов (follow-up)
---

## Цель
Утвердить стек (ADR) и поднять пустой, но проверенный каркас до прода: Next.js + PostgreSQL +
локали `/ru` `/en` + админская ветка `/admin` + тесты + CI, который собирает и прогоняет настоящий
Docker-образ, + автодеплой на `https://mycoruja.food` по образцу sup2. Следующие планы пишут
доменный код и не трогают инфраструктуру.

## Источник задачи
Владелец: «составь план: стек и каркас» (27.09) — шаг 1 `project-state.md`. 29.09 владелец дал:
репозиторий `julia15535/recipe` (публичный, пустой; у `igortsk123` пока только READ), домен
`mycoruja.food` (A → общий сервер владельца, детали — `.memory_bank/_secrets/ACCESS.md`),
«CI/CD как в sup2»; бэкап — локально, раз в сутки, ≤ 7 дней. 29.09 — «деплой» после правок по Codex.

## Решения, которые план фиксирует
Основа — стек, работающий у владельца в sup2/sib (Next.js + Drizzle + Postgres), с поправками по
граблям sup2/sib/remlab и по критике Codex (27.09, `external:codex`). Версии — `npm view` 27.09.2026.

### ADR-0011 — Стек и слои кода
| Слой | Выбор | Почему |
|------|-------|--------|
| Рантайм | **Node 24 LTS** (`.nvmrc`, `engines >=24 <25`; локально через nvm) | поддержка до 04.2028; Node 20 (sup2/sib) — EOL, 22 — до 04.2027 |
| Пакеты | **pnpm 12** точной версией в `packageManager` (corepack) | актуальный major; настройки сборки зависимостей — в `pnpm-workspace.yaml` |
| Фреймворк | Next.js 16.3 App Router, React 19, `output: "standalone"`, `poweredByHeader: false` | SSR для SEO; standalone — меньше образ |
| Язык | TypeScript **6.0.x**, `strict` + `noUncheckedIndexedAccess` | TS 7 не поддерживается typescript-eslint 8.70 (peer `<6.1`) |
| Линт | ESLint 9 flat: `eslint-config-next` 16.3 (`core-web-vitals` + `typescript`) напрямую, без FlatCompat | FlatCompat ломал деплой sup2; ESLint 10 — плагины не проверены |
| UI | Tailwind 4.3 + shadcn/ui 4 (`base-nova`, `@base-ui/react`) + lucide; семантические токены | как sup2 |
| Валидация | Zod 4 на всех внешних входах; env — см. ниже | `code-standards.md` |
| Тесты | Vitest 4 (домен) + Playwright (e2e на 375 px против собранного образа) | Vitest 5 — без выгоды для каркаса |

**Маршруты — две ветки с отдельными root layout** (route groups Next):
- `app/(public)/[locale]/…` — публичный сайт, next-intl, `localePrefix: "always"` (ADR-0009:
  `/ru/…`, `/en/…`). `/` → язык из cookie/`Accept-Language`, иначе `/ru`; неизвестная локаль → 404.
- `app/(admin)/admin/…` — админка, только RU, `noindex`, вне локалей.
- **Один `proxy.ts`** с явной композицией: публичные пути → next-intl; `/admin` → (позже) продление
  сессии, как sup2; `/api`, `/_next`, файлы — мимо. Авторизация всё равно проверяется в серверном
  слое у данных, не в proxy.
- **Canonical и hreflang — один источник:** автоматические `Link`-alternates next-intl выключены
  (`alternateLinks: false`), абсолютные URL строит metadata от `SITE_URL`; `x-default` → `/`.
- `www.mycoruja.food` → 301 на `mycoruja.food` (канонический хост).

**Слои кода:** `lib/domain/` — чистые функции без IO (пересчёт, округление, КБЖУ, иерархия) + тесты;
запрещено импортировать Next, БД, env, внешние API (ESLint `no-restricted-imports`).
`lib/server/` — `import "server-only"`: БД (`lib/server/db`), env, логгер, внешние API.
UI в БД не ходит.

**Env:** сборка образа не требует БД и секретов; на старте в production обязательны `DATABASE_URL`,
`GIT_SHA`, `SITE_URL` — без них процесс и `/api/health/ready` падают с понятной ошибкой (без тихих
дефолтов). Проверка — лениво, при первом обращении, не на этапе `next build`.

**Наблюдаемость (минимум):** JSON-логгер в stdout с `requestId`, версией, маскированием телефона,
токенов и текста импорта; `error.tsx`/`global-error.tsx` для UI. Внешний сервис ошибок — не сейчас.

**Заголовки:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`; HSTS — на прокси; полный CSP — обязателен до админки/импорта.

### ADR-0012 — Данные и миграции
- PostgreSQL 17 + Drizzle ORM 0.45 + postgres.js 3.4. Миграции: `drizzle-kit generate` → ревью SQL
  → `drizzle-kit migrate` (журнал `__drizzle_migrations`); ручной SQL — только `generate --custom`;
  `drizzle-kit push` в prod запрещён. Не raw-SQL remlab: схема Drizzle — единственный источник типов.
- **Применение в проде — не `drizzle-kit`:** в образе `standalone` нет devDependencies, поэтому
  `pnpm db:migrate`, как в sup2 (у него `next start` с полным `node_modules`), не сработает. В образ
  кладём `scripts/migrate.mjs` на `drizzle-orm/postgres-js/migrator` + папку `drizzle/`; сервер
  запускает `node scripts/migrate.mjs` одноразовым контейнером. Тот же скрипт — в CI (e2e).
- **Expand → код → backfill → contract** (как sup2 expand-only): миграция идёт ДО swap, откат образа
  схему не откатывает → rename/drop/`NOT NULL` без значения — только поэтапно, contract отдельным релизом.
- **Роли БД:** `recipe_owner` (владелец схемы, `NOLOGIN`), `recipe_migrator` (логин, `SET ROLE
  recipe_owner`), `recipe_app` (рантайм, только DML через default privileges; `REVOKE CREATE ON
  SCHEMA public FROM PUBLIC`). Таймауты: app `statement_timeout=15s`, `lock_timeout=3s`,
  `idle_in_transaction_session_timeout=30s`; migrator 5min / 5s / 60s. Env: `MIGRATION_DATABASE_URL`,
  `DATABASE_URL` — в разных файлах, веб-контейнер миграционный доступ не получает.
- **`scripts/migrate.mjs`:** одно физическое соединение, session `pg_try_advisory_lock` с дедлайном,
  мигратор на том же соединении, `pg_advisory_unlock` в `finally` (встроенного lock у Drizzle нет —
  проверить по установленной версии). CI запрещает миграцию «назад во времени» относительно `main`.
- Пул: web `max=5`, worker `max=2`, migrator `max=1`; `connect_timeout`, `idle_timeout`, `application_name`.
- Расширения поиска (`pg_trgm` и т.п.) — не в каркасе, а в плане поиска.

### ADR-0013 — Кэш публичных страниц
- `cacheComponents: true` + `"use cache"` + `cacheTag`; теги: `recipe:{id}`, `recipes`,
  `category:{id}`, `tag:{id}`, `catalog`. Правка владельцем → `updateTag` (сразу видит своё),
  сбрасываются обе локали, старый и новый slug, списки.
- **Проверка в каркасе:** next-intl 4 + `cacheComponents` на заглушке. Несовместимо → откат на ISR
  с `revalidateTag`, решение переписать в ADR до `completed`.

### ADR-0014 — CI/CD и прод (модель sup2, сборка вынесена в CI)
- **Сервер:** общий хост владельца (детали — только `.memory_bank/_secrets/ACCESS.md`): 1 vCPU,
  2.9 ГБ RAM, swap 1 ГБ, Docker 29 без `compose`, общий `nginx-proxy` + `acme-companion` (сеть
  `webproxy`). Соседние сервисы — только чтение, ни одного изменения.
- **Один артефакт от теста до прода.** CI собирает образ **один раз** → миграции (`node
  scripts/migrate.mjs` дважды) и e2e идут на **этом** образе → `docker save` в артефакт → отдельный
  job `publish` (единственный с `packages: write`) пушит `ghcr.io/julia15535/recipe:<full-sha>`, затем
  двигает `:stable`. `concurrency` на `main` с `cancel-in-progress`; перед promotion — проверка, что
  `github.sha` всё ещё HEAD `main`. Publish — только `push` в `main` и только при изменении кода
  (`code_changed`; docs-only коммит проходит check, образ не собирается — без `paths-ignore`, чтобы
  обязательная проверка не висела). Пакет публичный — сервер тянет анонимно.
- **Сервер тянет сам, как sup2** (`recipe-deploy.timer` каждые 5 мин → `/usr/local/bin/recipe-deploy.sh`,
  параметры — root-only `/etc/recipe/deploy.env`): flock (`9>&-`) → записать digest работающего
  `recipe-web` (точка отката) → `docker pull :stable` → digest тот же или в карантине
  (`failed-digest`) → выход → миграция одноразовым контейнером (логин migrator) → swap на
  `image@sha256:…` → smoke (`ready` = 200 **и** SHA = revision образа) → **любая** ошибка после начала
  swap → единый rollback-handler на сохранённый digest + проверка `ready` + карантин нового digest.
  Юнит `KillMode=process` (грабля sup2). Удаляются только старые recipe-образы (≥ 2 последних
  остаются); глобальных `prune` нет. Откат при потере локального образа — `pull :<sha>` из GHCR.
- **Контейнеры и лимиты** (старт, уточнить замером): web `--cpus=.25 --memory=384m
  --memory-swap=384m --pids-limit=128 --oom-score-adj=600`, non-root, `--read-only` + tmpfs,
  `--cap-drop=ALL`, `no-new-privileges`, `--init`; db postgres:17-alpine `.20/512m/512m/128/+300`,
  `shared_buffers=128MB`, `work_mem=2MB`, `max_connections=20`, `jit=off`, только `recipe-net`;
  migrator `.10/256m/+900`. Порты на хост не публикуются. Под давлением памяти первым умирает наш
  сайт, а не соседи. Остаточный риск (web в `webproxy` видит соседние контейнеры сети) — принят.
- **Секреты раздельно:** `/opt/recipe/web.env` (только `recipe_app`) и `/opt/recipe/migrate.env`
  (логин `recipe_migrator` → `SET ROLE recipe_owner`, owner — `NOLOGIN`), оба `0600`. Роли и права —
  идемпотентным `deploy/recipe-roles.sql`, запускается явно (init-скрипты Postgres срабатывают только
  на пустой базе).
- **Прокси — с предполётной проверкой:** digest образов прокси, `nginx -t`, никто другой не занял
  наши домены, эталон ответа julia-site → кандидат сначала проверяется только в `recipe-net` →
  подключение к `webproxy` → повтор проверок обоих сайтов (`curl --resolve`); ошибка — recipe сразу
  отключается. Один SAN-сертификат apex+www, прокси не перезапускаем, глобальные настройки companion
  не меняем. HSTS — смотрим, что ставит прокси, в Next не дублируем. `www` → apex — в приложении.
- **Бэкап (решение владельца 29.09):** `pg_dump -Fc` раз в сутки на сервере, хранить ≤ 7 дней;
  локальная машина владельца раз в сутки забирает свежий дамп по SSH (user-таймер,
  `Persistent=true`), хранит ≤ 7 дней; раз в неделю — автоматическое восстановление последнего
  локального дампа во временный Postgres 17 (`pg_restore --exit-on-error`, журнал миграций), затем
  временный контейнер удаляется. Новых секретов на сервере бэкап не требует.
- **Контроль (минимум):** тот же локальный таймер проверяет `ready`, свежесть дампа (≤ 26 ч),
  heartbeat деплой-таймера (≤ 15 мин), свободное место; итог — в журнал. Внешний канал алертов
  (Telegram) — follow-up: без него это журналирование, а не мониторинг.
- Скрипты и юниты — канонные копии в `deploy/` (как sup2), без IP и соседей; ставятся копированием.

### Направления для следующих планов (в `core/architecture.md`, не ADR)
- Фоновые задачи (импорт): очередь-таблица в Postgres (`FOR UPDATE SKIP LOCKED`, lease, retries,
  идемпотентность, graceful shutdown); воркер — **отдельный контейнер из того же образа**.
- Загрузки (голос, фото, PDF/DOCX): потоковый Route Handler, лимиты на каждом слое, MIME + magic
  bytes; не Server Actions для больших файлов.
- Rate limit: прокси + лимит в Postgres для входа и импорта; реальный IP за прокси.
- Вход: порт sup2 D10. ИИ: fetch-клиент `chatComplete()` через Vercel AI Gateway, как sup2.
- Slug по локалям (уникальность `(locale, slug)`, стабильный id, старые slug → 301) — в плане схемы БД.

## Вопросы владельцу
1. **Доступ к GitHub** (блокирует фазы 2–4): в `julia15535/recipe` → Settings → Collaborators →
   `igortsk123` с ролью **Admin** (настройки Actions, пакета, защиты `main` делаю сам) или **Write**
   (тогда пакет `recipe` публичным после первой сборки делаете вы).
2. **Разрешение авторежима на сервер** (блокирует фазу 4): правило в `.claude/settings.local.json` →
   `autoMode.allow` добавляет владелец (агенту самому расширять права запрещено).
3. ~~Публичный репо — чистка и склейка истории~~ — владелец: «все ок» (29.09).
4. ~~Внешний бэкап~~ — владелец (29.09): на локальную машину, раз в сутки, ≤ 7 дней, автоочистка.
5. **Канал алертов** (follow-up): Telegram-бот или другое — пока итог проверок только в журнале.

## Скоуп — что входит
- Фаза 0 — ADR-0011…0014, обновление памяти и правил; чистка инфраструктурных деталей из git-памяти,
  санитарная проверка, один начальный коммит.
- Фаза 1 — каркас локально (две ветки маршрутов, i18n, БД с ролями, мигратор, health, логгер,
  тесты, образ).
- Фаза 2 — push в `julia15535/recipe`, ветка `feature/skeleton`, PR.
- Фаза 3 — CI: проверки, один образ для e2e и прода, контроль миграций, публикация в GHCR, Dependabot.
- Фаза 4 — прод: сервер, автодеплой, HTTPS на mycoruja.food, бэкап с локальной копией. Совет Codex
  по прод-части получен (29.09, второй раунд) и внесён.

## Скоуп — что НЕ входит
- Доменная схема БД, вход, импорт, поиск, пересчёт, фото → профильные планы.
- Главная и дизайн: в каркасе — минимальная RU/EN-страница на семантических токенах + одна
  shadcn-кнопка; настоящая главная — после схемы каталога и поиска.
- sitemap.xml, JSON-LD, SEO-футер → план SEO. Индексация включается при запуске (`SITE_INDEXABLE`).
- Изменения чужих сервисов на сервере (julia-site, прокси, основные сервисы хоста), файрвол, перезапуск Docker/сервера.
- Внешний канал алертов и мониторинг аптайма → follow-up.

## Файлы к изменению
Фаза 0:
- [ ] `.memory_bank/decisions.md`, `core/architecture.md`, `core/access-and-integrations.md`,
      `project-state.md`, этот план — без инфраструктурных деталей; `.memory_bank/_secrets/ACCESS.md`
      (вне git); `.gitignore` — `/_secrets/` в корне
Фаза 1 (новые):
- [ ] `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.json`,
      `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`
- [ ] `proxy.ts` — композиция next-intl + ветка `/admin` + `www` → apex
- [ ] `i18n/routing.ts`, `i18n/request.ts`, `i18n/navigation.ts`, `messages/ru.json`, `messages/en.json`
- [ ] `app/(public)/[locale]/layout.tsx`, `page.tsx`, `not-found.tsx`, `error.tsx`
- [ ] `app/(admin)/admin/layout.tsx`, `page.tsx` — заглушка «вход — скоро», `noindex`
- [ ] `app/global-error.tsx`, `app/globals.css`, `app/robots.ts`
- [ ] `app/api/health/live/route.ts` (без БД), `app/api/health/ready/route.ts` (`select 1` с таймаутом, `GIT_SHA`)
- [ ] `lib/server/env.ts` (+ тест), `lib/server/db/client.ts`, `lib/server/db/schema/index.ts`,
      `lib/server/log.ts` (+ тест маскирования), `drizzle.config.ts`
- [ ] `scripts/migrate.mjs` — мигратор с advisory lock (+ тест двух параллельных запусков)
- [ ] `components/ui/button.tsx` (shadcn)
- [ ] `vitest.config.ts`, `test/server-only-stub.ts`, `playwright.config.ts`, `e2e/*.spec.ts`
- [ ] `docker-compose.yml` — локальный Postgres 17 на `127.0.0.1:5434` (5433 занят другим проектом)
      + `deploy/recipe-roles.sql` (идемпотентные роли; тот же файл — локально, в CI и в проде)
- [ ] `Dockerfile`, `.dockerignore` (multi-stage, standalone + явно `scripts/migrate.mjs`, `drizzle/`
      и их прод-модули, non-root, `GIT_SHA` build-arg + OCI-метки source/revision), `.env.example`
- [ ] `.gitignore` — node_modules, `.next`, `.env*` (кроме example), отчёты тестов (якорь от корня)
Фаза 3: - [ ] `.github/workflows/ci.yml`, `.github/dependabot.yml`
Фаза 4:
- [ ] `deploy/recipe-deploy.sh`, `deploy/recipe-deploy.{service,timer}`, `deploy/deploy.env.example`
- [ ] `deploy/recipe-db-backup.sh` + `deploy/recipe-db-backup.{service,timer}` (сервер, ≤ 7 дней)
- [ ] `deploy/local/recipe-backup-pull.sh` + user-юниты `.service/.timer` (локально, ≤ 7 дней, проверки)
- [ ] `deploy/local/recipe-restore-drill.sh` + еженедельный таймер; `deploy/README.md`
Память и правила:
- [ ] `CLAUDE.md` — стек, стадия, команды
- [ ] `.claude/rules/ui-rules.md`, `.claude/rules/code-standards.md` — пути под `app/(public)`,
      `app/(admin)`, `lib/domain`, `lib/server`
- [ ] `core/seo-i18n.md`, `core/deployment.md` (новая Tier 1), `changelog/project-history.md`,
      `core/lessons.md`

## Задачи
Фаза 0 — решения и чистка
- [ ] ADR-0011…0014 в `decisions.md`
- [ ] Инфраструктурные детали (имена и роли серверов, соседние сервисы, домашние пути) из всей
      git-памяти → `.memory_bank/_secrets/ACCESS.md`; `git check-ignore -v` для него и для
      `.claude/settings.local.json`; корневой `/_secrets/` — в `.gitignore`
- [ ] Санитарная проверка итогового дерева: gitleaks + trufflehog (docker-образы), grep по IP,
      именам хостов/сервисов, домашним путям, email, URL с паролями, `.env`
- [ ] Перед первым push: один начальный коммит (история из 5 локальных коммитов нигде не
      опубликована), нет тегов и других веток, push только `main` (не `--all`/`--mirror`)
Фаза 1 — каркас
- [ ] `nvm install 24`; `create-next-app` 16.3 (TS, Tailwind, App Router, без `src/`) → привести к ADR
- [ ] Route groups `(public)/[locale]` и `(admin)/admin` с отдельными root layout; `proxy.ts`
- [ ] next-intl: `ru|en`, `always`, default `ru`, `alternateLinks: false`; metadata: `metadataBase`,
      canonical, `alternates.languages` (ru, en, x-default → `/`) от `SITE_URL`
- [ ] `robots.ts` + meta `robots`: `SITE_INDEXABLE !== "true"` → `Disallow: /` и `noindex`
- [ ] Заглушка `/ru` `/en`: заголовок из `messages`, семантические токены, shadcn `Button`;
      `cacheComponents` включён — проверка совместимости с next-intl (ADR-0013)
- [ ] БД: docker-compose + `recipe-roles.sql`; клиент (`recipe_app`, пул `max=5`, таймауты);
      `drizzle.config.ts` (`strict`, `out: ./drizzle`, `MIGRATION_DATABASE_URL`)
- [ ] `scripts/migrate.mjs` (advisory lock); работает на пустом журнале и повторно; два
      параллельных запуска не мешают друг другу
- [ ] Env: ленивый Zod-парсер; production без обязательных переменных → явная ошибка
- [ ] Логгер JSON + маскирование; health `live` / `ready`
- [ ] Заголовки безопасности в `next.config.ts`
- [ ] ESLint: `no-explicit-any`, `no-console`, `no-restricted-imports` для `lib/domain/**`
- [ ] Скрипты: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `e2e`, `db:up`, `db:generate`,
      `db:migrate`, `db:check`
- [ ] Тесты — unit: env, логгер, мигратор; e2e — список в «Критериях приёмки»
- [ ] `docker build` локально; внутри образа `node scripts/migrate.mjs` работает; контейнер:
      `live` 200 без БД, `ready` 200 с БД и нужным SHA; запуск с `--read-only` + tmpfs
Фаза 2 — репозиторий
- [ ] `git remote add origin https://github.com/julia15535/recipe.git`; push `main` (после доступа)
- [ ] Ветка `feature/skeleton` → PR → слияние после зелёного CI
Фаза 3 — CI (минимальные `permissions` на каждый job, Actions по полному SHA, без `pull_request_target`)
- [ ] job `changes`: `code_changed` (всё, кроме `.memory_bank/**`, `docs/**`, `README.md`)
- [ ] job `check`: `pnpm install --frozen-lockfile` без peer-warnings → lint → typecheck → test →
      `db:generate` не даёт diff + `drizzle-kit check` + миграции не «назад во времени»
- [ ] job `image` (при `code_changed`): `docker build` один раз → service `postgres:17` + роли →
      `node scripts/migrate.mjs` дважды внутри образа → контейнер образа → Playwright (chromium,
      `workers: 1`) → `docker save` + checksum в артефакт
- [ ] job `publish` (только `push` в `main`, `code_changed`, `concurrency` с `cancel-in-progress`):
      проверить, что `github.sha` = HEAD `main` → загрузить артефакт → push `:<full-sha>`, затем
      `:stable`; `packages: write` только здесь
- [ ] Пакет GHCR публичный; анонимный pull проверен с пустым Docker config
- [ ] `dependabot.yml`: npm, Docker, GitHub Actions — еженедельно; CI по расписанию раз в неделю
      (без publish)
- [ ] Правило в `core/architecture.md`: критический CVE Next/React → обновление в тот же день
Фаза 4 — прод
- [ ] Эталон до начала (только чтение): digest образов прокси, `nginx -t`, env прокси/companion
      (без секретов), что за `VIRTUAL_HOST` уже заняты; julia-site — статус, TLS, hash тела ответа;
      хост — `free`, load, PSI, OOM в журнале, основные процессы хоста живы; список слушающих портов
- [ ] `/opt/recipe/` (`db/`, `backups/`, `state/`, `web.env` и `migrate.env` 0600), `/etc/recipe/deploy.env`;
      сеть `recipe-net`; `recipe-db` с лимитами и настройками памяти; `recipe-roles.sql` вручную
- [ ] `recipe-deploy.sh` + `.service` (`KillMode=process`) + `.timer` (5 мин); первый прогон вручную
- [ ] `recipe-web` сначала только в `recipe-net` (проверка `ready`), затем `webproxy` с
      `VIRTUAL_HOST`/`LETSENCRYPT_HOST` (или `ACME_HOST` — по версии companion), `VIRTUAL_PORT=3000`;
      один SAN-сертификат apex+www; повтор эталонных проверок julia-site — без изменений
- [ ] Бэкап на сервере (таймер, `pg_dump -Fc`, ≤ 7 файлов); локальный user-таймер (забрать дамп,
      ≤ 7 файлов, проверки `ready`/возраста дампа/heartbeat/диска); еженедельное восстановление
- [ ] Проверки отказов без публикации сломанного релиза: `recipe-deploy.sh --candidate <digest>`
      с заведомо плохим образом → откат и карантин; упавшая миграция → старый web работает;
      недоступный GHCR → ничего не останавливается; параллельный запуск блокируется flock
- [ ] После запуска: хост — те же показатели, что в эталоне (без OOM, процессы живы);
      владелец проверяет свои сервисы на этом хосте

## Критерии приёмки
- [ ] Локально и в CI зелёные: lint (с `no-explicit-any`, `no-console`), typecheck, test, e2e
- [ ] `pnpm install` без peer-warnings; `db:generate` не даёт diff; повторный `migrate` не меняет
      схему; два параллельных `migrate` — один ждёт, оба завершаются успешно
- [ ] e2e идёт против того же образа, что уходит в прод (standalone `server.js`)
- [ ] `/` → `/ru` без заголовков; → `/en` при `Accept-Language: en`; cookie локали уважается
- [ ] `/ru`, `/en` — 200, SSR (текст в HTML без JS), верный `lang`; `/fr` → 404
- [ ] canonical и hreflang (ru, en, x-default) — абсолютные URL от `SITE_URL`, без дублей из `Link`
- [ ] `/admin` открывается без локали, `noindex`; `/api/*` и статика не проходят через next-intl
- [ ] Заголовки безопасности присутствуют, `X-Powered-By` нет; `robots.txt` = Disallow при `SITE_INDEXABLE` ≠ true
- [ ] `live` = 200 при выключенной БД; `ready` = 503 при выключенной БД и 200 + SHA при включённой
- [ ] Контейнер в production без `DATABASE_URL`/`SITE_URL`/`GIT_SHA` не стартует молча — явная ошибка
- [ ] Рантайм подключается ролью `recipe_app`: DDL запрещён (тест); у web нет миграционного доступа
- [ ] 375 px: нет горизонтального скролла; Tab проходит по интерактивным элементам с видимым фокусом
- [ ] `cacheComponents` + next-intl проверены; итог (оставили или откатили на ISR) записан в ADR-0013
- [ ] Прод: `https://mycoruja.food/ru` открывается с телефона, сертификат валиден, `www` → apex с
      сохранением пути; `ready` отдаёт SHA последнего опубликованного зелёного релиза
- [ ] Прод: merge кода в `main` доезжает до сайта сам (≤ 10 мин после зелёного CI); docs-only
      коммит прод не перезапускает; плохой digest откатывается и не ставится повторно
- [ ] Прод: julia-site отвечает так же, как в эталоне (статус, TLS, hash тела); новых слушающих
      портов на хосте нет (`ss`, `docker port`); recipe-db и порт 3000 наружу не опубликованы
- [ ] Бэкап: на сервере и локально — не больше 7 дампов; восстановление последнего прошло
- [ ] Секретов в git нет; в публичном репо нет инфраструктурных деталей серверов (сканеры + grep)

## Риски и грабли (из sup2/sib/remlab)
- Next 16: `proxy.ts` вместо `middleware.ts`; после деплоя открытые вкладки ловят «Failed to find
  Server Action» — обработать, когда появятся actions.
- Drizzle: миграция = одна транзакция (новый enum-литерал нельзя использовать в той же миграции);
  `drizzle-kit` не читает `.env.local` → явная загрузка env.
- pnpm 12 требует явного разрешения build-скриптов зависимостей (esbuild, `@tailwindcss/oxide`…),
  иначе сборка без нативных бинарей — проверить при установке.
- Playwright на ядре 7.x — `--no-sandbox`; `.gitignore` с `coverage/` глотает вложенные — якорить к корню.
- Несколько root layout: переход между `(public)` и `(admin)` — полная перезагрузка (приемлемо).
- sup2: `9>&-` для flock и `KillMode=process` — без них деплой молча замирает / сайт падает через 45 с.
- Общий `nginx-proxy`: ошибка в нашем контейнере не должна ломать конфиг прокси для julia-site —
  подключаемся только штатными env, проверяем julia-site до и после.
- 1 CPU: лимиты `--cpus`/`--memory` обязательны; сборок на сервере нет.

## Definition of Done — память (без этого `completed` запрещён)
- [ ] `decisions.md` (ADR-0011…0014); `core/architecture.md` — стек утверждён, слои, направления
- [ ] `core/deployment.md` (новая область) — видна в INDEX; `core/seo-i18n.md`; `core/access-and-integrations.md`
- [ ] `project-state.md` переписан; `CLAUDE.md` — команды
- [ ] «Уроки» заполнены → `core/lessons.md`
- [ ] Крупный план → субагент `verify` до `/memory-check`
- [ ] `/memory-check` выполнен, audit «чисто»

## Лог выполнения
- 2026-09-27 — план создан (draft); факты по sup2/sib/remlab собраны субагентом Explore
- 2026-09-27 — критика Codex (33 замечания, `external:codex`) сверена и принята: Node 24, pnpm 12,
  route groups + один `proxy.ts`, единый источник canonical/hreflang, env fail-fast, роли БД и
  expand/contract, кэш `cacheComponents` с проверкой, health live/ready, e2e против образа, сборка
  образа в CI, Dependabot; расширения поиска и фальшивая главная убраны
- 2026-09-29 — владелец: репо `julia15535/recipe`, домен mycoruja.food (→ общий сервер владельца), «CI/CD как
  в sup2». Сервер проверен только чтением (ресурсы, контейнеры, сеть `webproxy`); дальнейшее чтение
  конфигов на проде упёрлось в фильтр авторежима — нужно разрешение владельца. Прод возвращён в план
  фазой 4; деплой — модель sup2 (серверный таймер, smoke по SHA, откат), но образ из CI/GHCR
- 2026-09-29 — второй раунд Codex по прод-части (35 замечаний, `external:codex`) сверен с кодом sup2
  и принят: один образ от e2e до прода, запуск по digest, `:stable` только для зелёного HEAD,
  digest отката фиксируется до pull, единый rollback-handler, карантин плохого digest, advisory lock
  в миграторе, раздельные env web/migrator, числовые лимиты и OOM-приоритет, предполётная проверка
  прокси, `.memory_bank/_secrets/`, санитарная проверка публичного репо. Не принято как есть:
  «перезагрузка Docker/сервера» в проверках (уронит соседние сервисы хоста) → только restart-policy.
  Бэкап — по решению владельца локально (новых секретов на сервере не нужно)
- 2026-09-29 — владелец: «деплой» → статус `in_progress`; правило авторежима на сервер агенту
  добавить запрещено (Self-Modification) — добавляет владелец; доступ к GitHub — ждём

## Completion summary
[Заполняется при переводе в completed]

### Уроки (ОБЯЗАТЕЛЬНО; для partial/cancelled — особенно)
[—]

## Follow-up work
- [ ] План «правила округления» (шаг 2 `project-state.md`)
- [ ] План «схема БД» (рецепт, ингредиенты, каталог, переводы, slug по локалям) — совет Codex
