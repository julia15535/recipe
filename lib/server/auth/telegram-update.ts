// Разбор обновления Telegram в намерение (без БД и сети): что это — /start с вызовом, кнопка
// подтверждения, посторонний или мусор. Чистый модуль — его проверяют юнит-тесты.
import { z } from "zod";

import { hashToken, TOKEN_PATTERN } from "./tokens";

const chat = z.object({ id: z.number().int(), type: z.string() });
const user = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  is_bot: z.boolean().optional(),
  first_name: z.string().max(256).optional(),
  username: z.string().max(64).optional(),
});

export const updateSchema = z.object({
  update_id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  message: z.object({ message_id: z.number().int(), chat, from: user.optional(), text: z.string().max(4096).optional() }).optional(),
  callback_query: z
    .object({
      id: z.string().min(1).max(64),
      from: user,
      data: z.string().max(64).optional(),
      message: z.object({ message_id: z.number().int(), chat }).optional(),
    })
    .optional(),
});
export type TelegramUpdate = z.infer<typeof updateSchema>;

export type Intent =
  | { kind: "ignore" }
  | { kind: "foreign"; chatId: number }
  | { kind: "help"; chatId: number }
  | { kind: "start"; chatId: number; challengeHash: Buffer }
  | { kind: "callback-refused"; callbackId: string }
  | {
      kind: "callback";
      callbackId: string;
      chatId: number;
      messageId: number;
      action: "ok" | "no";
      challengeId: string;
      telegramId: bigint;
      displayName: string | null;
    };

const START = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;
const CALLBACK = /^(ok|no):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

function displayName(from: z.infer<typeof user>): string | null {
  const name = from.username ? `@${from.username}` : from.first_name?.trim();
  return name ? name.slice(0, 64) : null;
}

/** Только личный чат; владелец — строгое сравнение id как bigint с OWNER_TELEGRAM_ID. */
export function planUpdate(update: TelegramUpdate, ownerTelegramId: bigint): Intent {
  const { message, callback_query: callback } = update;
  if (message) {
    if (message.chat.type !== "private" || !message.from || message.from.is_bot) return { kind: "ignore" };
    if (BigInt(message.from.id) !== ownerTelegramId) return { kind: "foreign", chatId: message.chat.id };
    const payload = START.exec(message.text ?? "")?.[1];
    if (payload && TOKEN_PATTERN.test(payload)) {
      return { kind: "start", chatId: message.chat.id, challengeHash: hashToken(payload) };
    }
    return { kind: "help", chatId: message.chat.id };
  }
  if (callback) {
    const target = callback.message;
    if (!target || target.chat.type !== "private" || BigInt(callback.from.id) !== ownerTelegramId) {
      return { kind: "callback-refused", callbackId: callback.id };
    }
    const match = CALLBACK.exec(callback.data ?? "");
    if (!match) return { kind: "callback-refused", callbackId: callback.id };
    return {
      kind: "callback",
      callbackId: callback.id,
      chatId: target.chat.id,
      messageId: target.message_id,
      action: match[1] === "ok" ? "ok" : "no",
      challengeId: match[2] ?? "",
      telegramId: BigInt(callback.from.id),
      displayName: displayName(callback.from),
    };
  }
  return { kind: "ignore" };
}
