---
tier: 2
topic: owner-auth
scope: Вход владельца через своего Telegram-бота — поток, таблицы, cookie, webhook, CSP кабинета, тесты, аварийные действия
tier1: ../core/auth-publishing.md
updated: 2026-10-02
importance: high
source: manual
status: working
source_of_truth: canonical
last_verified: 2026-10-02
review_after: 2026-12-27
---

# Вход владельца — детали (ADR-0022, план owner-login-telegram)

## Поток
1. `GET /admin/login` ничего не пишет (`app/(admin)/admin/login/page.tsx`). Кнопка «Войти через Telegram» —
   Server Action `startLogin` (`app/(admin)/admin/login/actions.ts`, `useActionState`): живая попытка этого
   браузера переиспользуется (вторая вкладка видит тот же код), «Начать заново» (`restart=1`) гасит её
   (ожидающую или подтверждённую, но не использованную → `cancelled`); отказ — сообщение на месте
   («Слишком много попыток…», «Вход пока не настроен»). Попытка — `startChallenge`
   (`lib/server/auth/challenge.ts`): challenge и привязка по 256 бит (`lib/server/auth/tokens.ts`), код
   4 цифры, срок 10 минут (`CHALLENGE_TTL_MS`).
2. Экран ожидания (`login-waiting.tsx`): код крупно, «Открыть Telegram» (`t.me/<бот>?start=<challenge>`,
   новая вкладка), QR (`login-qr.tsx`, `uqr`, свой SVG; виден от `md`). Опрос `POST /api/auth/status`
   раз в 2 с и при возврате на вкладку (`use-login-status.ts`); другой код в ответе — перерисовка.
   Состояния: ожидание, «нет связи с сайтом» (опрос продолжается), время вышло, отменено в Telegram,
   попытка закончилась; подтверждено — сразу переход. Отдельного «Telegram недоступен» нет: если Bot API
   не отвечает, бот молчит, а страница ждёт до конца срока.
3. Бот: `/start <challenge>` от владельца → сообщение «Код: NNNN… Нажмите «Подтвердить», только если этот
   же код виден у вас на экране» + кнопки `ok:<uuid>` / `no:<uuid>` (`lib/server/auth/bot-messages.ts`).
   Подтверждает только `callback_query` от `OWNER_TELEGRAM_ID` в личном чате (`telegram-update.ts`,
   сравнение `bigint`); после — правка сообщения «Вход подтверждён… вернитесь на сайт».
4. Статус (`app/api/auth/status/route.ts`) ищет попытку **только по cookie привязки**; `confirmed` →
   атомарно `consumed` + новая сессия в одной транзакции (`lib/server/auth/complete-login.ts`) →
   cookie сессии, привязка удаляется, вкладка уходит в `/admin`. Повторный запрос сессию не получит:
   на живую `consumed` он слышит «ещё ждём», и следующий опрос видит общую cookie сессии (две вкладки).

## Таблицы (`lib/server/db/schema/auth.ts`, миграция `drizzle/0001_owner_auth.sql`)
- `owner_login_challenges`: `challenge_hash`, `binding_hash` (bytea UNIQUE), `code` (CHECK 4 цифры),
  `status` (`pending|confirmed|rejected|consumed|cancelled`), `ip_hash` (HMAC IP ключом секрета webhook),
  `telegram_id`, `display_name`, сроки.
- `owner_sessions`: `token_hash` UNIQUE, `telegram_id`, `display_name`, `expires_at` (ровно 30 дней,
  без продления), `revoked_at`. `telegram_updates`: обработанные `update_id`.
- Уборка (`lib/server/auth/prune.ts`): не чаще раза в 10 минут на процесс, порциями по 1000 — попытки
  старше суток, `update_id` старше недели, мёртвые сессии старше 30 дней; сбой уборки вход не срывает.
- Лимит: 20 нажатий «Войти» за 10 минут с адреса — сначала в памяти процесса, без БД
  (`lib/server/auth/rate-limit.ts`), затем 20 попыток с адреса и 2000 живых всего в БД (`LOGIN_LIMITS`).
  Адрес — `X-Real-IP` от nginx-proxy, иначе последний `X-Forwarded-For`; IPv6 — сеть /64 (`ipKey`).

## Cookie (`lib/server/auth/cookies.ts`)
- `__Host-login_binding` = «привязка.challenge»: HttpOnly, Secure, SameSite=Strict, 10 минут.
- `__Host-owner_session`: HttpOnly, Secure, SameSite=Lax, Path=/, срок = сроку в БД.

## Проверка владельца
- `getOwner()` / `requireOwner()` (`lib/server/auth/owner.ts`): сессия жива, не отозвана, `telegram_id` =
  текущему `OWNER_TELEGRAM_ID` (смена в env закрывает старые сессии). Вызов — в layout `(protected)`, в
  каждой странице кабинета и пробных экранов и в Server Action `logout` (`app/(admin)/admin/(protected)/actions.ts`).
- `proxy.ts`: без cookie сессии — 307 на `/admin/login` (только удобство, не авторизация); matcher
  пропускает через proxy любой `/admin/…`, даже с точкой в адресе.

## Webhook (`app/api/telegram/webhook/route.ts`, `lib/server/auth/webhook.ts`)
Нет настроек — 503; неверный `X-Telegram-Bot-Api-Secret-Token` — 401; с секретом всё прочее — 200:
тело > 64 KB отбрасывается (на не-2xx Telegram повторяет доставку), мусор, дубликат, сообщение из
группы — без действий; посторонний — общий ответ без кода не чаще раза в час на чат; кнопка от
постороннего или из группы — «Недоступно». Посторонние и мусор в БД не пишутся (бот публичный).
Ошибка БД — 500 (Telegram повторит; «попробуйте позже» нет — его слал бы каждый повтор). Запись `update_id` и смена статуса — одна транзакция. Ответы бота —
после ответа Telegram (`after()`), ошибка отправки только в лог (`lib/server/auth/telegram.ts`: метод и
код, без адреса с токеном). Включение — `scripts/telegram-webhook.mjs set` (`allowed_updates`:
`message`, `callback_query`; `drop_pending_updates`).

## CSP и рендер кабинета
- `proxy.ts` для `/admin`: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'unsafe-inline'`
  (style-атрибуты React Aria; Safari без `style-src-attr`), `frame-ancestors 'none'`, `base-uri 'none'`,
  `form-action 'self'`; `Referrer-Policy: no-referrer` (`next.config.ts`).
- Корневой layout кабинета: `instant = false` + `await connection()` — nonce несовместим с PPR-оболочкой.
  Следствие: `redirect()`/`notFound()` внутри рендера приходят уже в потоке с кодом 200 (anti-patterns №23).

## Env (`lib/server/env-schema.ts` `parseAuthEnv`)
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `OWNER_TELEGRAM_ID` (< 2^52) — все или
ни одной (ни одной — вход выключен, «Вход пока не настроен»; часть — сервер не стартует,
`instrumentation-node.ts`). `TELEGRAM_API_BASE` — только заглушка Bot API в e2e.

## Модули без `server-only`
Чистые, их берут юнит-тесты: `lib/server/auth/tokens.ts`, `telegram-update.ts`, `bot-messages.ts`.

## Логи
Ошибки БД входа заворачиваются в `AuthStorageError` с кодом Postgres (`lib/server/auth/storage-error.ts`):
текст ошибки Drizzle содержит параметры запроса (хеши), а Next пишет необработанные ошибки в лог.
Webhook и статус пишут только имя ошибки; маскирование ключей — `lib/server/log.ts`.

## Тесты
Юнит: `lib/server/auth/tokens.test.ts`, `telegram-update.test.ts`, `rate-limit.test.ts`, `lib/server/env.test.ts`, `log.test.ts`.
БД (`pnpm test:db`): `lib/server/auth/auth.db.test.ts` — только хеши, гонка двух подтверждений и двух
вкладок, просрочка, «Это не я», чужой аккаунт, отзыв/смена владельца, права роли `recipe_app`.
e2e: `e2e/auth.spec.ts` — через настоящий webhook с CI-секретом и заглушку Bot API (`e2e/global-setup.ts`);
`e2e/auth.setup.ts` входит один раз, остальные тесты кабинета — с сохранённой сессией.

## Известные мелочи
Два одновременных «Начать заново» в одном браузере могут создать две попытки, а cookie запомнит одну:
вход не выдаётся чужому, но подтверждение «лишней» попытки ни к чему не приведёт — начать заново ещё раз.

## Аварийно
Сменить токен/секрет, отозвать все сессии, сменить владельца — `deploy/README.md` «Вход владельца».
