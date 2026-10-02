import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";

import { type Executor, getDb } from "@/lib/server/db/client";
import { ownerLoginChallenges as challenges, telegramUpdates } from "@/lib/server/db/schema";

import { answer, BOT_TEXT, type BotCall, confirmKeyboard, edit, send } from "./bot-messages";
import { allow } from "./rate-limit";
import { guarded } from "./storage-error";
import { type Intent, planUpdate, updateSchema } from "./telegram-update";

type Context = { ownerTelegramId: bigint; siteUrl: string };
type OwnerIntent = Extract<Intent, { kind: "help" | "start" | "callback" }>;
const HOUR_MS = 60 * 60 * 1000;
const live = and(eq(challenges.status, "pending"), gt(challenges.expiresAt, sql`now()`));

/**
 * Обработка тела webhook. Посторонние и мусор в БД не пишутся (бот публичный — иначе таблица растёт
 * от чужих сообщений); постороннему — один общий ответ в час. Для владельца запись update_id и смена
 * статуса вызова — одна транзакция: повтор того же обновления ничего не меняет. Ошибка БД
 * пробрасывается (маршрут ответит 5xx — Telegram повторит). Возвращает ответы бота «по возможности».
 */
export async function handleWebhookBody(body: string, ctx: Context): Promise<BotCall[]> {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return [];
  }
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return [];
  const intent = planUpdate(parsed.data, ctx.ownerTelegramId);
  if (intent.kind === "ignore") return [];
  if (intent.kind === "callback-refused") return [answer(intent.callbackId, "Недоступно")];
  if (intent.kind === "foreign") {
    return allow(`tg-foreign:${intent.chatId}`, 1, HOUR_MS) ? [send(intent.chatId, BOT_TEXT.foreign(ctx.siteUrl))] : [];
  }
  return guarded(() =>
    getDb().transaction(async (tx) => {
      const fresh = await tx
        .insert(telegramUpdates)
        .values({ updateId: parsed.data.update_id })
        .onConflictDoNothing()
        .returning({ id: telegramUpdates.updateId });
      return fresh.length ? apply(intent, ctx, tx) : [];
    }),
  );
}

async function apply(intent: OwnerIntent, ctx: Context, tx: Executor): Promise<BotCall[]> {
  switch (intent.kind) {
    case "help":
      return [send(intent.chatId, BOT_TEXT.help(ctx.siteUrl))];
    case "start": {
      // /start только показывает запрос с кодом — подтверждает отдельная кнопка.
      const [row] = await tx
        .select({ id: challenges.id, code: challenges.code })
        .from(challenges)
        .where(and(eq(challenges.challengeHash, intent.challengeHash), live));
      if (!row) return [send(intent.chatId, BOT_TEXT.expired(ctx.siteUrl))];
      return [send(intent.chatId, BOT_TEXT.confirm(row.code), confirmKeyboard(row.id))];
    }
    case "callback": {
      const confirm = intent.action === "ok";
      const [row] = await tx
        .update(challenges)
        .set(
          confirm
            ? { status: "confirmed", telegramId: intent.telegramId, displayName: intent.displayName, confirmedAt: sql`now()` }
            : { status: "rejected" },
        )
        .where(and(eq(challenges.id, intent.challengeId), live))
        .returning({ code: challenges.code });
      if (!row) {
        return [answer(intent.callbackId, "Запрос устарел"), edit(intent.chatId, intent.messageId, BOT_TEXT.expired(ctx.siteUrl))];
      }
      const text = confirm ? BOT_TEXT.confirmed(row.code) : BOT_TEXT.rejected;
      return [answer(intent.callbackId, confirm ? "Вход подтверждён" : "Вход отменён"), edit(intent.chatId, intent.messageId, text)];
    }
  }
}
