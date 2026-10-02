import "server-only";

import type { AuthConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";

import type { BotCall } from "./bot-messages";

/**
 * Ответы бота «по возможности»: ошибка отправки не отменяет уже записанного подтверждения.
 * В лог — только метод и код ответа: адрес запроса содержит токен бота, текст — код входа.
 */
export async function sendBotCalls(calls: BotCall[], config: AuthConfig): Promise<void> {
  for (const call of calls) {
    try {
      const response = await fetch(`${config.apiBase}/bot${config.botToken}/${call.method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(call.params),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!response.ok) log.warn("telegram: Bot API отказал", { method: call.method, status: response.status });
    } catch (error) {
      log.warn("telegram: Bot API недоступен", { method: call.method, reason: error instanceof Error ? error.name : "unknown" });
    }
  }
}
