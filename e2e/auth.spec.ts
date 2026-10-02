import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import {
  answerInTelegram,
  botCalls,
  botPrompt,
  CLIENT_IP,
  OWNER_STATE,
  pressUpdate,
  sendUpdate,
  startLogin,
  startUpdate,
  STRANGER_ID,
  TELEGRAM,
  telegramClient,
} from "./support/telegram";

// Вход владельца через своего Telegram-бота (план owner-login-telegram): webhook вызывается как
// настоящий Telegram, ответы бота — из заглушки Bot API. Без секрета (e2e против прода) — пропуск.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET");
test.use({ extraHTTPHeaders: CLIENT_IP });

const SESSION = "__Host-owner_session";
const FAKE_ID = "00000000-0000-4000-8000-000000000000";
const BINDING = "__Host-login_binding";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Нарушения CSP из консоли браузера за время теста. */
function cspErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) errors.push(msg.text());
  });
  return errors;
}

test.describe("вход владельца — без сессии", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("кабинет и пробные экраны ведут на вход; страница входа ничего не создаёт до нажатия", async ({ page, request }) => {
    for (const path of ["/admin", "/admin/ui", "/admin/ui/home", "/admin/ui/recipe/syrniki", "/admin/recipes/new", `/admin/recipes/${FAKE_ID}`, `/admin/recipes/${FAKE_ID}/edit`]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers().location).toMatch(/\/admin\/login$/);
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
    // Чужой или старый cookie сессии proxy пропускает — отказ даёт проверка у данных.
    const forged = await request.get("/admin", { headers: { cookie: `${SESSION}=${"A".repeat(43)}` } });
    expect(await forged.text()).not.toContain("Вы вошли");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вход в кабинет");
    expect(await page.context().cookies()).toEqual([]);
    const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test("заголовки: CSP с nonce у каждого скрипта, no-referrer, без кеша", async ({ request }) => {
    const res = await request.get("/admin/login");
    const csp = res.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(nonce).toBeTruthy();
    expect(res.headers()["referrer-policy"]).toBe("no-referrer");
    expect(res.headers()["cache-control"]).toContain("no-store");
    const scripts = (await res.text()).match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`))).toEqual([]);
  });

  test("webhook: без секрета и с чужим — 401; большое тело, мусор и группа — 200 без ответа", async ({ baseURL }) => {
    const api = await telegramClient(baseURL);
    expect((await sendUpdate(api, startUpdate("x"), "")).status()).toBe(401);
    expect((await sendUpdate(api, startUpdate("x"), "wrong-secret-0000000000000000000000000")).status()).toBe(401);
    const secret = { "x-telegram-bot-api-secret-token": TELEGRAM.secret };
    const big = await api.post("/api/telegram/webhook", { data: { update_id: 1, pad: "x".repeat(70_000) }, headers: secret });
    expect(big.status()).toBe(200);
    const garbage = await api.post("/api/telegram/webhook", { data: "{not json", headers: { ...secret, "content-type": "application/json" } });
    expect(garbage.status()).toBe(200);
    const group = { message: { message_id: 1, date: 0, chat: { id: -100_777, type: "group" }, from: { id: TELEGRAM.ownerId, is_bot: false, first_name: "А" }, text: "/start" } };
    expect((await sendUpdate(api, group)).status()).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect((await botCalls(api)).filter((c) => c.params.chat_id === -100_777)).toEqual([]);
    await api.dispose();
  });

  test("полный вход: тот же код в боте, «Старт» без «Подтвердить» не впускает, cookie с нужными флагами", async ({ page, baseURL }) => {
    const errors = cspErrors(page);
    const api = await telegramClient(baseURL);
    const attempt = await startLogin(page);
    expect(attempt.code).toMatch(/^\d{4}$/);
    const binding = (await page.context().cookies()).find((c) => c.name === BINDING);
    expect(binding).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
    const bindingMinutes = ((binding?.expires ?? 0) * 1000 - Date.now()) / 60_000;
    expect(bindingMinutes).toBeGreaterThan(9.5);
    expect(bindingMinutes).toBeLessThanOrEqual(10);
    await expect(page.getByText("Ждём подтверждения в Telegram…")).toBeVisible();
    await expect(page.getByRole("img", { name: /QR-код/ })).toBeHidden();
    const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

    expect((await sendUpdate(api, startUpdate(attempt.challenge))).status()).toBe(200);
    const prompt = await botPrompt(api, attempt.code);
    expect(prompt.text).toContain("только если этот же код");
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/admin\/login$/);

    expect((await sendUpdate(api, pressUpdate(prompt.reply_markup.inline_keyboard[0]?.[0]?.callback_data ?? ""))).status()).toBe(200);
    await page.waitForURL(/\/admin$/);
    await expect(page.getByText("Вы вошли через Telegram как @author.")).toBeVisible();
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === SESSION);
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    // Сессия — новый токен, не привязка и не challenge из ссылки.
    expect(session?.value).not.toBe(attempt.challenge);
    expect(binding?.value.split(".")).not.toContain(session?.value);
    const days = ((session?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(cookies.find((c) => c.name === BINDING)).toBeUndefined();
    await expect
      .poll(async () => (await botCalls(api)).some((c) => c.method === "editMessageText" && String(c.params.text).includes("Вход подтверждён")))
      .toBe(true);
    expect(errors).toEqual([]);
    await api.dispose();
  });

  test("перехваченный challenge в чужом браузере не даёт входа; статус с чужого сайта — 403", async ({ page, browser, baseURL }) => {
    const api = await telegramClient(baseURL);
    const attempt = await startLogin(page);
    const thief = await browser.newContext();
    const thiefPage = await thief.newPage();
    await thiefPage.goto(`/admin/login?start=${attempt.challenge}`);
    const thiefStatus = await thiefPage.evaluate(() => fetch("/api/auth/status", { method: "POST" }).then((r) => r.json()));
    expect(thiefStatus).toEqual({ state: "none" });

    await answerInTelegram(api, attempt);
    await page.waitForURL(/\/admin$/);
    await thiefPage.goto("/admin");
    await expect(thiefPage).toHaveURL(/\/admin\/login$/);
    const crossSite = await api.post("/api/auth/status", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } });
    expect(crossSite.status()).toBe(403);
    await thief.close();
    await api.dispose();
  });

  test("две вкладки: один и тот же код, после подтверждения обе в кабинете", async ({ page, baseURL }) => {
    const api = await telegramClient(baseURL);
    const second = await page.context().newPage();
    await second.goto("/admin/login");
    const attempt = await startLogin(page);
    // Вторая вкладка открыта раньше: её «Войти» не создаёт новую попытку, а показывает ту же.
    await second.getByRole("button", { name: "Войти через Telegram" }).click();
    await expect(second.locator("[data-login-code]")).toHaveText(attempt.code);
    await answerInTelegram(api, attempt);
    await page.waitForURL(/\/admin$/);
    await second.waitForURL(/\/admin$/);
    await api.dispose();
  });

  test("чужой аккаунт: бот не показывает код, его кнопка не впускает", async ({ page, baseURL }) => {
    const api = await telegramClient(baseURL);
    const attempt = await startLogin(page);
    await sendUpdate(api, startUpdate(attempt.challenge, STRANGER_ID));
    await sendUpdate(api, startUpdate(attempt.challenge));
    const prompt = await botPrompt(api, attempt.code);
    const toStranger = (await botCalls(api)).filter((c) => c.params.chat_id === STRANGER_ID);
    expect(toStranger.length).toBeGreaterThan(0);
    expect(toStranger.map((c) => String(c.params.text)).join()).not.toContain(attempt.code);

    await sendUpdate(api, pressUpdate(prompt.reply_markup.inline_keyboard[0]?.[0]?.callback_data ?? "", STRANGER_ID));
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByText("Ждём подтверждения в Telegram…")).toBeVisible();
    await api.dispose();
  });

  test("«Это не я» отменяет вход — страница предлагает начать заново", async ({ page, baseURL }) => {
    const api = await telegramClient(baseURL);
    const attempt = await startLogin(page);
    await answerInTelegram(api, attempt, 1);
    await expect(page.getByText("Вход отменён в Telegram. Если это были вы — начните заново.")).toBeVisible();
    await page.getByRole("button", { name: "Начать заново" }).click();
    await expect(page.locator("[data-login-code]")).toBeVisible();
    await api.dispose();
  });

  test("выход: сессия отозвана — старый cookie больше не пускает", async ({ page, baseURL }) => {
    const api = await telegramClient(baseURL);
    await answerInTelegram(api, await startLogin(page));
    await page.waitForURL(/\/admin$/);
    const session = (await page.context().cookies()).find((c) => c.name === SESSION);
    await page.getByRole("button", { name: "Выйти" }).click();
    await page.waitForURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    if (session) await page.context().addCookies([session]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await api.dispose();
  });

  test("лимит попыток: после 20 с одного адреса — понятное сообщение", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { "x-real-ip": `10.0.${Date.now() % 250}.${Math.floor(Math.random() * 250)}` } });
    const page = await context.newPage();
    await startLogin(page);
    for (let i = 1; i < 20; i += 1) {
      const before = await page.locator("[data-login-code]").textContent();
      await page.getByRole("button", { name: "Начать заново" }).click();
      await expect(page.locator("[data-login-code]")).not.toHaveText(before ?? "", { timeout: 5000 }).catch(() => undefined);
    }
    await page.getByRole("button", { name: "Начать заново" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Слишком много попыток входа" })).toBeVisible();
    await context.close();
  });

  test("компьютер: QR-код ссылки на бота виден @desktop", async ({ page }) => {
    await startLogin(page);
    await expect(page.getByRole("img", { name: /QR-код/ })).toBeVisible();
  });
});

test.describe("вход владельца — с сессией", () => {
  test.use({ storageState: OWNER_STATE });

  test("пробные экраны под CSP: скрипты работают при прямом заходе и переходах, нарушений нет", async ({ page }) => {
    const errors = cspErrors(page);
    const direct = await page.request.get("/admin/ui/recipe/syrniki");
    const nonce = /'nonce-([^']+)'/.exec(direct.headers()["content-security-policy"] ?? "")?.[1];
    const scripts = (await direct.text()).match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`))).toEqual([]);
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Пробные экраны" }).click();
    await page.waitForURL(/\/admin\/ui$/);
    await page.getByRole("link", { name: "Открыть" }).nth(2).click();
    await page.waitForURL(/\/admin\/ui\/recipe\/syrniki$/);
    await page.getByRole("textbox", { name: "Творог 5%" }).fill("250");
    await expect(page.getByRole("listitem").filter({ hasText: "Мука" })).toContainText("30 г");
    expect(errors).toEqual([]);
  });
});
