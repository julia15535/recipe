import { describe, expect, it } from "vitest";

import { confirmKeyboard } from "./bot-messages";
import { planUpdate, type TelegramUpdate, updateSchema } from "./telegram-update";
import { hashToken, newToken } from "./tokens";

const OWNER = 9007199254740993n; // больше 2^53: сравнение строго как bigint
const OWNER_NUM = 459_255_913;
const owner = { id: OWNER_NUM, is_bot: false, first_name: "Автор", username: "author" };
const privateChat = { id: OWNER_NUM, type: "private" };
const ID = "3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function message(text: string, from = owner, chat = privateChat): TelegramUpdate {
  return updateSchema.parse({ update_id: 1, message: { message_id: 10, chat, from, text } });
}

function callback(data: string, from = owner, chat = privateChat): TelegramUpdate {
  return updateSchema.parse({ update_id: 2, callback_query: { id: "cb", from, data, message: { message_id: 11, chat } } });
}

describe("разбор обновлений Telegram", () => {
  const ownerId = BigInt(OWNER_NUM);

  it("/start с вызовом от владельца → хеш вызова, сам вызов дальше не идёт", () => {
    const challenge = newToken();
    const intent = planUpdate(message(`/start ${challenge}`), ownerId);
    expect(intent.kind).toBe("start");
    if (intent.kind === "start") expect(intent.challengeHash.equals(hashToken(challenge))).toBe(true);
  });

  it("/start без вызова или с мусором → инструкция владельцу", () => {
    expect(planUpdate(message("/start"), ownerId).kind).toBe("help");
    expect(planUpdate(message("/start <script>"), ownerId).kind).toBe("help");
    expect(planUpdate(message("привет"), ownerId).kind).toBe("help");
  });

  it("посторонний — общий ответ, даже с верным вызовом", () => {
    const stranger = { ...owner, id: OWNER_NUM + 1 };
    expect(planUpdate(message(`/start ${newToken()}`, stranger, { id: OWNER_NUM + 1, type: "private" }), ownerId)).toEqual({
      kind: "foreign",
      chatId: OWNER_NUM + 1,
    });
  });

  it("группа, канал и боты — пропускаем молча", () => {
    expect(planUpdate(message(`/start ${newToken()}`, owner, { id: -100, type: "group" }), ownerId).kind).toBe("ignore");
    expect(planUpdate(message("/start", { ...owner, is_bot: true }), ownerId).kind).toBe("ignore");
    expect(planUpdate(updateSchema.parse({ update_id: 3 }), ownerId).kind).toBe("ignore");
  });

  it("кнопки «Подтвердить» и «Это не я» от владельца — с id вызова и именем", () => {
    const [ok, no] = confirmKeyboard(ID).inline_keyboard.map((row) => row[0]?.callback_data ?? "");
    expect(planUpdate(callback(ok ?? ""), ownerId)).toMatchObject({ kind: "callback", action: "ok", challengeId: ID, displayName: "@author" });
    expect(planUpdate(callback(no ?? ""), ownerId)).toMatchObject({ kind: "callback", action: "no", challengeId: ID });
  });

  it("кнопка от чужого, из группы или с подделанными данными — отказ", () => {
    const stranger = { ...owner, id: OWNER_NUM + 1 };
    expect(planUpdate(callback(`ok:${ID}`, stranger), ownerId).kind).toBe("callback-refused");
    expect(planUpdate(callback(`ok:${ID}`, owner, { id: -100, type: "supergroup" }), ownerId).kind).toBe("callback-refused");
    expect(planUpdate(callback("ok:1 or 1=1"), ownerId).kind).toBe("callback-refused");
  });

  it("сравнение id точное: соседний id — посторонний; id за пределами точных чисел JS не пройдёт как владелец", () => {
    const neighbour = { ...owner, id: OWNER_NUM + 1 };
    expect(planUpdate(message("/start", neighbour, { id: OWNER_NUM + 1, type: "private" }), ownerId).kind).toBe("foreign");
    expect(planUpdate(message("/start"), ownerId).kind).toBe("help");
    expect(planUpdate(message("/start"), OWNER).kind).toBe("foreign");
    expect(updateSchema.safeParse({ update_id: 1, message: { message_id: 1, chat: privateChat, from: { id: 2 ** 53 } } }).success).toBe(false);
  });
});
