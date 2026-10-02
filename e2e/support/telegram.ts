import { type APIRequestContext, expect, type Page, request } from "@playwright/test";

// Вход владельца в e2e — через настоящий публичный webhook (как Telegram), без «чёрных ходов».
// Секрет и id — заведомо фальшивые значения CI (те же, что у запущенного сайта).
export const TELEGRAM = {
  secret: process.env.E2E_TELEGRAM_WEBHOOK_SECRET ?? "",
  ownerId: Number(process.env.E2E_OWNER_TELEGRAM_ID ?? 0),
  stubPort: Number(process.env.E2E_TELEGRAM_STUB_PORT ?? 3999),
  get enabled() {
    return Boolean(this.secret && this.ownerId);
  },
};
export const OWNER_STATE = "e2e/.auth/owner.json";
// Свой «адрес» у каждого прогона: сайт ограничивает попытки входа с одного IP (20 за 10 минут),
// а без прокси (CI, локально) берёт адрес из X-Real-IP как есть.
const octet = () => Math.floor(Math.random() * 250) + 1;
export const CLIENT_IP = { "x-real-ip": `10.${octet()}.${octet()}.${octet()}` };
// Свой «посторонний» на каждый прогон: общий ответ постороннему бот шлёт не чаще раза в час.
export const STRANGER_ID = 2_000_000 + Math.floor(Math.random() * 1_000_000);

type BotCall = { method: string; params: Record<string, unknown> };
type Prompt = { text: string; reply_markup: { inline_keyboard: { callback_data: string }[][] } };
let updateId = Math.floor(Math.random() * 1e9);

/** Отдельный клиент без cookie браузера — так приходят запросы от Telegram. */
export function telegramClient(baseURL: string | undefined): Promise<APIRequestContext> {
  return request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
}

export function sendUpdate(api: APIRequestContext, update: object, secret = TELEGRAM.secret) {
  const headers = secret ? { "x-telegram-bot-api-secret-token": secret } : undefined;
  return api.post("/api/telegram/webhook", { data: { update_id: (updateId += 1), ...update }, headers });
}

const user = (id: number) => ({ id, is_bot: false, first_name: "Автор", username: "author" });
const chat = (id: number) => ({ id, type: "private" });

export const startUpdate = (challenge: string, from = TELEGRAM.ownerId) => ({
  message: { message_id: 1, date: 0, chat: chat(from), from: user(from), text: `/start ${challenge}` },
});
export const pressUpdate = (data: string, from = TELEGRAM.ownerId) => ({
  callback_query: { id: `cb-${updateId}`, chat_instance: "1", from: user(from), data, message: { message_id: 2, date: 0, chat: chat(from) } },
});

export async function botCalls(api: APIRequestContext): Promise<BotCall[]> {
  return (await (await api.get(`http://127.0.0.1:${TELEGRAM.stubPort}/__calls`)).json()) as BotCall[];
}

/** Сообщение бота с этим кодом в чате владельца — и данные его кнопок. */
export async function botPrompt(api: APIRequestContext, code: string, chatId = TELEGRAM.ownerId): Promise<Prompt> {
  let prompt: Prompt | undefined;
  await expect
    .poll(async () => {
      const found = (await botCalls(api)).findLast(
        (call) => call.method === "sendMessage" && call.params.chat_id === chatId && String(call.params.text).includes(`Код: ${code}`),
      );
      prompt = found?.params as Prompt | undefined;
      return Boolean(prompt);
    })
    .toBe(true);
  return prompt as Prompt;
}

/** «Войти через Telegram» на сайте: код на экране и challenge из ссылки на бота. */
export async function startLogin(page: Page): Promise<{ code: string; challenge: string }> {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Войти через Telegram" }).click();
  const code = (await page.locator("[data-login-code]").textContent())?.trim() ?? "";
  const href = (await page.getByRole("link", { name: "Открыть Telegram" }).getAttribute("href")) ?? "";
  return { code, challenge: new URL(href).searchParams.get("start") ?? "" };
}

/** В Telegram: «Старт» → сообщение с кодом → кнопка (первая — «Подтвердить», вторая — «Это не я»). */
export async function answerInTelegram(api: APIRequestContext, attempt: { code: string; challenge: string }, button = 0) {
  expect((await sendUpdate(api, startUpdate(attempt.challenge))).status()).toBe(200);
  const prompt = await botPrompt(api, attempt.code);
  const data = prompt.reply_markup.inline_keyboard[button]?.[0]?.callback_data ?? "";
  expect((await sendUpdate(api, pressUpdate(data))).status()).toBe(200);
  return data;
}

export async function loginAsOwner(page: Page, api: APIRequestContext) {
  await answerInTelegram(api, await startLogin(page));
  await page.waitForURL(/\/admin$/);
}
