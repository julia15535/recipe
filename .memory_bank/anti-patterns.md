---
tier: 2
topic: anti-patterns
scope: Каталог повторяющихся ошибок — чеклист при code-review
tier1: core/lessons.md
updated: 2026-10-02
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

## 16. Мелкий текст Manrope (12 px)
**Симптом:** в `text-xs` пробелы между русскими словами почти исчезают («Отмеченоавтором поингредиентам»),
особенно после «о» и «е» — видно на снимке, тесты не ловят.
**Convention:** поясняющий текст — не меньше `text-sm` (14 px); `text-xs` — только подписи из 1–2 слов
(например, раздел над названием в карточке). Новый мелкий текст — смотреть на снимке экрана.

## 17. Локальный e2e против `.env.local`
**Симптом:** падают проверки canonical/hreflang и www → основной домен: они ждут
`SITE_URL=https://mycoruja.food`, а локальная сборка взяла адрес из `.env.local`; `webServer` с
`pnpm start` при `output: standalone` зависает после тестов.
**Convention:** локально как в CI — `SITE_URL=https://mycoruja.food pnpm build`, сервер запустить
отдельно (`pnpm start`, порт 3010), тесты — `E2E_BASE_URL=http://127.0.0.1:3010 SITE_URL=… pnpm e2e`,
после — погасить сервер по PID (№15).

## 18. «Назад» по `document.referrer` в Next
**Симптом:** кнопка «Назад» не узнаёт, что пришли со страницы сайта: при переходах внутри Next
(`Link`, `router.push`) `document.referrer` не меняется, а `history.length` считает и чужие записи
(вкладка, `about:blank`).
**Convention:** `window.navigation?.canGoBack` (Navigation API видит только записи сайта) →
`router.back()`, иначе — на главную (`app/(admin)/admin/(protected)/ui/_components/search-prototype.tsx`).

## 19. Невидимые кнопки React Aria в проверке размера касаний
**Симптом:** открытый Modal/Dialog даёт «BUTTON «» 1px» в проверке целей ≥ 44 px — это скрытые кнопки
«закрыть» для экранного диктора (`DismissButton`), не цели касания.
**Convention:** в проверке пропускать элементы ≤ 2 px (`e2e/prototypes.spec.ts`, `smallTargets`).

## 20. axe во время появления окна
**Симптом:** `color-contrast` падает на тексте в только что открытом Modal: идёт плавное появление
(`data-entering`), цвета полупрозрачные (3,6 : 1 вместо 5).
**Convention:** перед axe ждать конца анимации — `page.waitForFunction(() => !document.querySelector("[data-entering]"))`
(`e2e/prototypes.spec.ts`).

## 21. Скрытая прошлая страница в e2e (Next 16)
**Симптом:** после перехода по ссылке CSS-выборка `page.locator("main …")` находит лишние элементы — Next
16 (Cache Components) держит прошлую страницу смонтированной, но скрытой, чтобы «назад» был мгновенным.
**Convention:** в e2e — запросы по ролям (`getByRole` скрытое не видит) или `:visible` в CSS-выборке
(`e2e/prototypes.spec.ts`, `recipeCards`).

## 22. Иконка как переменная-компонент
**Симптом:** `const Icon = pick(id); <Icon />` внутри компонента — ESLint `react-hooks/static-components`
(«Cannot create components during render»).
**Convention:** отдельный компонент с `createElement(MAP[id] ?? Fallback, props)` (`components/catalog/section-icon.tsx`).

## 23. Код ответа в кабинете при `redirect()`/`notFound()` (Cache Components)
**Симптом:** без входа `/admin` отвечает 200 (переход на вход — уже в браузере), несуществующая страница
кабинета — тоже 200; тест «ждём 404/307» падает.
**Причина:** кабинет полностью динамический и отдаётся потоком (CSP с nonce, `instant = false`) — заголовки
уходят до того, как рендер дойдёт до `redirect()`/`notFound()`.
**Convention:** честный 307 — «оптимистично» в `proxy.ts` по наличию cookie (проверка — всё равно
`requireOwner()`); в e2e проверять страницу («Такой страницы в кабинете нет»), а не код.

## 24. Иконка-компонент из серверного компонента в кнопку
**Симптом:** `Functions cannot be passed directly to Client Components` при `<AppButton iconLeading={Send}>`
в серверном компоненте (страница падает в «Что-то пошло не так»).
**Convention:** кнопки с иконкой — внутри `"use client"`-компонента (`app/(admin)/admin/(protected)/_components/logout-form.tsx`).

## 25. Отказ Server Action через `redirect("?e=…")`
**Симптом:** ответ с `x-action-redirect: /admin/login?e=limit`, но адрес и страница не меняются — сообщение
об ошибке не видно (Next 16.3.8, тот же путь с другим `?`).
**Convention:** отказ — возвращать состояние через `useActionState` (`start-login-form.tsx`), успех — `refresh()`.

## 26. Лимит попыток по IP и e2e с одного адреса
**Симптом:** повторные прогоны e2e за 10 минут падают на входе: сработал свой же лимит (20 попыток с IP).
**Convention:** каждый прогон шлёт свой `X-Real-IP` (`e2e/support/telegram.ts` `CLIENT_IP`); без прокси сайт
берёт его как есть. За nginx-proxy заголовок перезаписывает прокси.

## 27. `request` в Playwright без сессии
**Симптом:** закрытая страница через фикстуру `request` отдаёт вход, хотя у проекта `storageState`.
**Причина:** фикстура `request` создаётся без `storageState` браузера.
**Convention:** запросы с сессией — `page.request`; без сессии и как «Telegram» — отдельный `request.newContext()`.

## 28. Вход по ссылке из бота без подтверждения (login CSRF)
**Симптом (на плане, до кода):** `/start <challenge>` сразу подтверждает вход → злоумышленник начинает вход у
себя и подсовывает владельцу свою ссылку; она жмёт «Старт» — сессию получает чужой браузер (критика Codex 02.10).
Отброшен и архивный Telegram Login Widget.
**Convention:** `/start` только показывает код; подтверждает кнопка, «только если этот же код на экране»;
сессию получает браузер с cookie привязки (ADR-0022, `lib/server/auth/webhook.ts`).

## 29. Лимит, который проверяется после работы с БД
**Симптом (ревью Codex 02.10):** уже заблокированный по лимиту запрос всё равно делал уборку и подсчёты
в БД — поток POST занимал весь пул из 5 соединений; публичный бот писал в БД каждое чужое сообщение.
**Convention:** отказ по лимиту — первым и без БД (`lib/server/auth/rate-limit.ts`), уборка — редко и
порциями (`prune.ts`), от посторонних в БД ничего не пишем; подлинному обновлению Telegram — всегда 2xx.

## 30. Импорт из папки, которой нет в образе
**Симптом:** локально сборка зелёная, в CI «Сборка образа» падает: `Cannot find module './e2e/support/…'`.
**Причина:** `.dockerignore` не кладёт в образ `e2e/`, `tools/`, `deploy/`…, а `next build` проверяет типы
всех `*.ts`, включая `playwright.config.ts`.
**Convention:** файлы в корне и в `app/ lib/ components/ scripts/` не импортируют из исключённых папок
(константу — продублировать с комментарием, как `OWNER_STATE` в `playwright.config.ts`).

## 31. `getByRole("alert")` в e2e находит объявитель переходов Next
**Симптом:** strict mode violation — второй `role="alert"` это пустой `#__next-route-announcer__`.
**Convention:** `getByRole("alert").filter({ hasText: … })` (`e2e/recipes.spec.ts`).

## 32. Zod: `refine` выполняется и после проваленного `regex`
**Симптом:** `BigInt("@user")` бросил `SyntaxError` вместо понятной ошибки env.
**Convention:** в `refine` заново проверять форму значения (`/^\d+$/.test(v) && …`, `lib/server/env-schema.ts`).

## 33. Флаг `i` с `\p{Lu}` в регулярке
**Симптом:** «Рецепт вафель…» потеряло «Рецепт»: с флагом `i` класс заглавных совпадает и со строчными.
**Convention:** регистр — явным классом (`[Рр]ецепт`) без `i` (`lib/domain/recipe-text/parse.ts`).

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

