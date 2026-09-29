---
tier: 2
topic: anti-patterns
scope: Каталог повторяющихся ошибок — чеклист при code-review
tier1: core/lessons.md
updated: 2026-09-29
importance: med
source: manual
status: working
source_of_truth: supporting
---

# Anti-patterns — каталог граблей

> Записывай сюда повторяющиеся ошибки (особенно от кодогена). Используется как чеклист в ревью
> и читается вместе с `core/lessons.md` перед планированием (`agent-workflow.md`, Этап 1).
> Чем конкретнее «как детектить в diff» — тем полезнее. Устаревшие помечай (`~~…~~`), файл
> целиком не переписывай (протокол — как у lessons: инкрементальные правки).

## Формат записи
```
## N. Короткое название проблемы
**Симптом:** как выглядит в коде.
**Причина:** почему это происходит (особенно у кодогена).
**Convention:** как правильно.
**Детект в diff:** что грепать / на что смотреть в ревью.
**Фикс:** конкретное исправление (find/replace или вручную).
```

---

## 1. Пример: локальное переобъявление общего типа
**Симптом:** тип/интерфейс объявлен заново в фиче вместо импорта из общего модуля.
**Причина:** кодоген не «видит» существующий тип и создаёт дубль.
**Convention:** импортировать из единого источника типов.
**Детект в diff:** новое `interface X`/`type X`, имя которого уже есть в общих типах.
**Фикс:** удалить локальный, импортировать общий.

## 2. Zod `z.preprocess` стирает поля при частичном патче
**Симптом:** автосейв/partial-update обнуляет поля, которые пользователь не трогал.
**Причина:** `z.preprocess(fn, schema).optional()` — `fn` вызывается и на ОТСУТСТВУЮЩЕМ ключе;
типичная проверка `v == null` истинна для `undefined` → absent превращается в `null` → поле стирается.
**Convention:** хелперы полей без `preprocess` — `z.union([z.null(), z.literal("").transform(()=>null), …]).optional()`.
**Детект в diff:** `z.preprocess` в схеме патча/частичного апдейта.
**Фикс:** убрать preprocess; тест: частичный патч `{одно_поле}` → в выходе ТОЛЬКО это поле.

## 3. Доверие клиентскому патчу (mass-assignment)
**Симптом:** объект из запроса пишется в БД целиком (`update(table).set(patch)`).
**Причина:** не отфильтрованы server-controlled поля (id/ownerId/status/role/timestamps).
**Convention:** валидировать вход Zod-схемой, куда server-controlled поля НЕ включены — `.parse()` их стрипает.
**Детект в diff:** `.set(patch)` / `{...patch}` без схемы; патч прямо из `req.body`/`formData`.
**Фикс:** прогнать через `schema.safeParse` → писать только `parsed.data`.

## 4. Тяжёлые вычисления в request-пути
**Симптом:** парсинг больших файлов / отчёты / массовые операции прямо в хендлере → таймауты, блокировки.
**Причина:** синхронная тяжёлая работа в горячем пути запроса.
**Convention:** разовое лёгкое — ок в роуте; тяжёлое/массовое — в воркер/очередь.
**Детект в diff:** циклы на тысячи элементов, парс больших буферов, генерация Excel/PDF в server action/route.
**Фикс:** вынести в фоновую задачу; в ответе — статус/прогресс.

## 5. (base-ui / headless Menu) онклик и обязательные обёртки — в recipe не применимо (с ADR-0015 — React Aria)
**Симптом:** пункт меню «молча не срабатывает» (особенно на тач); ИЛИ страница падает в error-boundary.
**Причина:** `Menu.Item` активируется по `onClick`, не `onSelect` (typecheck не ловит — `onSelect` есть как
DOM-событие). А `Menu.GroupLabel` требует родителя `Menu.Group` — иначе рантайм-ошибка (краш страницы).
**Convention:** в пунктах меню — `onClick`; `GroupLabel`/label-части оборачивать в `Group`.
**Детект в diff:** `onSelect=` на `*MenuItem`; `*MenuLabel` напрямую в `*MenuContent` без `*MenuGroup`.
**Фикс:** `onSelect`→`onClick`; обернуть label в group. (Минифицированный код ошибки прод-сборки —
расшифровывай из исходника пакета: `node_modules/<pkg>/**/*Context.js`, рядом dev-сообщение.)

## 6. Мажор новее, чем поддерживают линтеры
**Симптом:** после обновления TypeScript/ESLint падает `typescript-eslint` или плагины Next.
**Convention:** мажор — только если его допускают peer-зависимости (`npm view typescript-eslint peerDependencies`); на 29.09 — TS 6.0, ESLint 9, Vitest 4.
**Детект в diff:** bump `typescript`/`eslint`/`vitest` на новый мажор в `package.json`.

## 7. pnpm 12: запрещённые build-скрипты
**Симптом:** `ERR_PNPM_IGNORED_BUILDS`; pnpm дописывает `name: set this to true or false` в `pnpm-workspace.yaml` (дубль ключа).
**Convention:** решать `allowBuilds` явно по пакету (`esbuild: true`, остальные с prebuilt-бинарями — `false`).
**Детект в diff:** строка-заглушка или дубль ключа в `pnpm-workspace.yaml`.

## 8. drizzle-kit в прод-образе
**Симптом:** `pnpm db:migrate` в standalone-образе не работает — devDependencies нет.
**Convention:** прод-миграции — `scripts/migrate.mjs` (drizzle-orm migrator + advisory lock), в образе — бандл esbuild `migrator/migrate.mjs`; CI гоняет именно его внутри образа.
**Детект в diff:** `drizzle-kit`/`pnpm` в CMD/скриптах деплоя.

## 9. Редирект по хосту в proxy.ts
**Симптом:** `www…/robots.txt`, `/api`, статика не перенаправляются — matcher proxy их пропускает.
**Convention:** host-редиректы — `redirects()` в `next.config.ts` (`statusCode: 301`).
**Детект в diff:** `request.headers.get("host")`/`nextUrl.host` в `proxy.ts`.

## 10. Next пишет в CLAUDE.md
**Симптом:** после `next dev` в `CLAUDE.md` появляется блок `nextjs-agent-rules`.
**Convention:** `agentRules: false` в `next.config.ts`.
**Детект в diff:** маркер `BEGIN:nextjs-agent-rules` в `CLAUDE.md`/`AGENTS.md`.

## 11. Проверка HTML-атрибутов с учётом регистра
**Симптом:** e2e не находит `hreflang=` — React выводит `hrefLang`; x-default для `/` без слэша.
**Convention:** атрибуты — регэксп с флагом `i`; URL — с учётом нормализации Next.
**Детект в diff:** `toContain('hreflang=` в тестах.

## 12. /tmp на dev-машине — маленький tmpfs
**Симптом:** `playwright install` падает «Download failure».
**Convention:** `TMPDIR=$HOME/.cache/tmp-playwright pnpm exec playwright install chromium`.

## 13. «denied» при pull публичного образа из ghcr.io
**Симптом:** публичный образ не скачивается: в `~/.docker/config.json` устаревший логин ghcr.
**Convention:** анонимный pull проверять с `DOCKER_CONFIG` на пустой `{}`; на сервере логина в ghcr нет.

## 14. React Aria: группа-переключатель — это radio, Tooltip не работает на тач
**Симптом:** e2e не находит `getByRole("button", …)` у ButtonGroup; подсказка не открывается по тапу.
**Convention:** ButtonGroup (ToggleButtonGroup, single) — роли `radiogroup`/`radio`; подсказки на тач —
Popover по тапу, не Tooltip.
**Детект в diff:** `getByRole("button"` для сегментов; `Tooltip` в мобильных экранах.

## 15. Остановка локального next-сервера
**Симптом:** `pkill -f <путь>` убивает саму команду (путь есть в её тексте); после kill родителя
дочерний `next-server` держит порт и отдаёт старый HTML со ссылками на удалённые стили — страница без CSS.
**Convention:** искать по PID и рабочей папке (`readlink /proc/<pid>/cwd`), гасить и дочерний
`next-server`; проверять, что порт свободен (`ss -ltn`), до нового старта.

---

# Анти-паттерны ПАМЯТИ (уроки эксплуатации — актуальны любому проекту с Memory Bank)

## M1. Знание утекло в авто-память харнесса, банк пуст
**Симптом:** `~/.claude/.../memory/` полна живых фактов, `.memory_bank/` замёрз на недели.
**Причина:** харнесс пишет в авто-память по умолчанию; захват в банк не запускался.
**Convention:** `/memory-check` Этап 1.5 МОСТ реконсилит слои; проектное живёт только в банке.
**Детект:** авто-память растёт, `core/*` не меняются; SessionStart-баннер показывает возраст.

## M2. project-state распух в журнал (50 КБ хроники вместо снимка)
**Симптом:** «где проект сейчас» = прочитать весь лог; токены жгутся при каждом resume.
**Convention:** снимок ПЕРЕПИСЫВАЕТСЯ (≤10 KB); хронология — append в `changelog/project-history.md`.
**Детект:** audit BLOATED.

## M3. Фича в проде, но её нет в decision tree
**Симптом:** целые домены (интеграции, воркеры, каталоги) не находимы по INDEX→core.
**Convention:** новая функциональная область ⇒ `core/<домен>.md` до завершения плана
(гейт в plans/_template + `/memory-check` Этап 1.4).
**Детект:** audit NO-TIER1; ручная проверка «найду ли фичу за 1 drill».

## M4. Слой знаний замёрз, а аудит молчит
**Симптом:** core/ и domain/ отстают от реальности на недели, попарный STALE молчит
(оба слоя замёрзли ВМЕСТЕ), audit «✓ чисто» — ложная уверенность.
**Convention:** свежесть меряется против project-state (audit LAGGING), не только попарно.

## M5. Две `.memory_bank` (док-директория + код-репо)
**Симптом:** планы коммитятся в одну копию, память ведётся в другой; никто не знает канон.
**Convention:** ОДНА `.memory_bank` в репо кода (`DEPLOY.md` «Каноничное расположение»);
вторую свести и заменить README-указателем.
**Детект:** audit DIVERGENCE; `_memory-canon.txt` фиксирует канон.

<!-- Дальше — реальные грабли конкретного проекта. -->

