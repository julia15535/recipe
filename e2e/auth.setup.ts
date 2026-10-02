import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { test as setup } from "@playwright/test";

import { CLIENT_IP, loginAsOwner, OWNER_STATE, TELEGRAM, telegramClient } from "./support/telegram";

// Один вход владельца на весь прогон: пробные экраны и кабинет закрыты входом, их тесты берут
// сохранённую сессию (storageState). Без секрета webhook (e2e против прода) — пустое состояние.
setup.use({ extraHTTPHeaders: CLIENT_IP });

setup("вход владельца для закрытых страниц", async ({ page, baseURL }) => {
  mkdirSync(dirname(OWNER_STATE), { recursive: true });
  writeFileSync(OWNER_STATE, JSON.stringify({ cookies: [], origins: [] }));
  setup.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — закрытые страницы не проверить");
  const api = await telegramClient(baseURL);
  await loginAsOwner(page, api);
  await page.context().storageState({ path: OWNER_STATE });
  await api.dispose();
});
