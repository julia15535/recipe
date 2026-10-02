// Webhook бота входа владельца (план owner-login-telegram): включить, посмотреть, выключить.
// Запуск с машины, где есть токен (значения — в .memory_bank/_secrets/ACCESS.md, вне git):
//   node --env-file=<файл с TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SITE_URL> \
//        scripts/telegram-webhook.mjs set|info|delete
// Токен, секрет и IP сервера не печатаются: только адрес webhook, очередь и последняя ошибка.
const [command = "info"] = process.argv.slice(2);
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

if (!["set", "info", "delete"].includes(command)) {
  console.error("usage: telegram-webhook.mjs set|info|delete");
  process.exit(2);
}
if (!token || (command === "set" && (!secret || !site.startsWith("https://")))) {
  console.error("нужны TELEGRAM_BOT_TOKEN, а для set — ещё TELEGRAM_WEBHOOK_SECRET и SITE_URL (https://…)");
  process.exit(2);
}

async function call(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await response.json().catch(() => ({}));
  if (!json.ok) throw new Error(`${method}: ${json.description ?? `HTTP ${response.status}`}`);
  return json.result;
}

try {
  if (command === "set") {
    await call("setWebhook", {
      url: `${site}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
      max_connections: 5,
    });
  }
  if (command === "delete") await call("deleteWebhook", { drop_pending_updates: false });
  const info = await call("getWebhookInfo");
  console.log(
    JSON.stringify(
      {
        url: info.url || "(не задан)",
        pending_update_count: info.pending_update_count,
        allowed_updates: info.allowed_updates,
        max_connections: info.max_connections,
        last_error: info.last_error_message
          ? `${new Date(info.last_error_date * 1000).toISOString()} ${info.last_error_message}`
          : null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "ошибка запроса к Telegram");
  process.exit(1);
}
