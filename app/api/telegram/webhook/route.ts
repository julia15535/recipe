import { after } from "next/server";

import { sendBotCalls } from "@/lib/server/auth/telegram";
import { secretsEqual } from "@/lib/server/auth/tokens";
import { handleWebhookBody } from "@/lib/server/auth/webhook";
import { getAuthConfig, getSiteConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";

// Webhook бота входа (план owner-login-telegram). Секрет — в заголовке, который Telegram ставит
// по setWebhook(secret_token). Сырые обновления не логируем: в них коды и challenge.
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  const config = getAuthConfig();
  if (!config) return new Response(null, { status: 503 });
  if (!secretsEqual(request.headers.get("x-telegram-bot-api-secret-token"), config.webhookSecret)) {
    return new Response(null, { status: 401 });
  }
  const body = await readLimited(request);
  // Подлинное (с секретом), но огромное обновление — подтверждаем и отбрасываем: на не-2xx Telegram
  // повторяет доставку, и такое обновление застряло бы в очереди.
  if (body === null) {
    log.warn("telegram webhook: слишком большое обновление пропущено");
    return new Response(null, { status: 200 });
  }

  try {
    const calls = await handleWebhookBody(body, {
      ownerTelegramId: config.ownerTelegramId,
      siteUrl: getSiteConfig().siteUrl,
    });
    if (calls.length) after(() => sendBotCalls(calls, config));
    return new Response(null, { status: 200 });
  } catch (error) {
    log.error("telegram webhook: обновление не обработано", { reason: error instanceof Error ? error.name : "unknown" });
    return new Response(null, { status: 500 });
  }
}

async function readLimited(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
