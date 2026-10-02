// Вход владельца против живой БД (pnpm db:up): запускается в `pnpm test:db` (RECIPE_DB_TESTS=1),
// в обычном `pnpm test` пропускается. Ходит ролью рантайма recipe_app — права проверяются заодно.
import { randomBytes } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { getDb, getSql } from "@/lib/server/db/client";
import { ownerLoginChallenges as challenges, ownerSessions, telegramUpdates } from "@/lib/server/db/schema";

import type { BotCall } from "./bot-messages";
import { findActiveByBinding, startChallenge } from "./challenge";
import { completeLogin } from "./complete-login";
import { createSession, findSession, revokeSession } from "./session";
import { hashToken } from "./tokens";
import { handleWebhookBody } from "./webhook";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const OWNER = 700_000_000 + Math.floor(Math.random() * 1_000_000);
const ctx = { ownerTelegramId: BigInt(OWNER), siteUrl: "https://example.test" };
const created: string[] = [];
let updateId = Math.floor(Math.random() * 1e9);

async function start(limits = { perIp: 100, pending: 10_000 }) {
  const result = await startChallenge({ ipHash: randomBytes(32), previousBindingHash: null }, limits);
  if (!result.ok) throw new Error("ожидали новый вызов");
  const [row] = await getDb().select({ id: challenges.id }).from(challenges).where(eq(challenges.bindingHash, hashToken(result.binding)));
  created.push(row?.id ?? "");
  return { ...result, id: row?.id ?? "" };
}

function webhook(update: object, id = (updateId += 1)): Promise<BotCall[]> {
  return handleWebhookBody(JSON.stringify({ update_id: id, ...update }), ctx);
}

const from = (id = OWNER) => ({ id, is_bot: false, first_name: "Автор", username: "author" });
const chat = (id = OWNER) => ({ id, type: "private" });
const startMessage = (challenge: string, sender = OWNER) => ({
  message: { message_id: 1, chat: chat(sender), from: from(sender), text: `/start ${challenge}` },
});
const press = (data: string, sender = OWNER) => ({
  callback_query: { id: "cb", from: from(sender), data, message: { message_id: 2, chat: chat(sender) } },
});

async function statusOf(id: string) {
  const [row] = await getDb().select({ status: challenges.status }).from(challenges).where(eq(challenges.id, id));
  return row?.status;
}

describe.skipIf(!enabled)("вход владельца: БД", () => {
  afterAll(async () => {
    await getDb().delete(challenges).where(inArray(challenges.id, created));
    await getDb().delete(ownerSessions).where(eq(ownerSessions.telegramId, BigInt(OWNER)));
    await getSql().end({ timeout: 5 });
  });

  it("вызов: в БД только хеши, вторая вкладка находит его по привязке", async () => {
    const attempt = await start();
    const [row] = await getDb().select().from(challenges).where(eq(challenges.id, attempt.id));
    expect(row?.challengeHash.equals(hashToken(attempt.challenge))).toBe(true);
    expect(JSON.stringify(row)).not.toContain(attempt.challenge);
    expect(JSON.stringify(row)).not.toContain(attempt.binding);
    expect((await findActiveByBinding(hashToken(attempt.binding)))?.code).toBe(attempt.code);
    const minutes = ((row?.expiresAt.getTime() ?? 0) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9.9);
    expect(minutes).toBeLessThanOrEqual(10);
  });

  it("«Начать заново» отменяет прежний вызов этой привязки", async () => {
    const first = await start();
    const second = await startChallenge({ ipHash: randomBytes(32), previousBindingHash: hashToken(first.binding) });
    if (second.ok) created.push(...(await findActiveByBinding(hashToken(second.binding)).then((c) => (c ? [c.id] : []))));
    expect(await statusOf(first.id)).toBe("cancelled");
    expect(await findActiveByBinding(hashToken(first.binding))).toBeNull();

    // Подтверждённую, но не использованную попытку «Начать заново» тоже гасит.
    const confirmed = await start();
    await webhook(press(`ok:${confirmed.id}`));
    const third = await startChallenge({ ipHash: randomBytes(32), previousBindingHash: hashToken(confirmed.binding) });
    if (third.ok) created.push((await findActiveByBinding(hashToken(third.binding)))?.id ?? "");
    expect(await statusOf(confirmed.id)).toBe("cancelled");
    expect((await completeLogin(hashToken(confirmed.binding), ctx.ownerTelegramId)).state).toBe("none");
  });

  it("ограничение частоты: с одного адреса и всего живых вызовов", async () => {
    const ip = randomBytes(32);
    const limits = { perIp: 2, pending: 10_000 };
    for (let i = 0; i < 2; i += 1) {
      const ok = await startChallenge({ ipHash: ip, previousBindingHash: null }, limits);
      if (ok.ok) created.push((await findActiveByBinding(hashToken(ok.binding)))?.id ?? "");
    }
    expect(await startChallenge({ ipHash: ip, previousBindingHash: null }, limits)).toEqual({ ok: false, reason: "rate-limited" });
    expect(await startChallenge({ ipHash: randomBytes(32), previousBindingHash: null }, { perIp: 100, pending: 0 })).toEqual({
      ok: false,
      reason: "rate-limited",
    });
  });

  it("/start показывает код и кнопки, но не подтверждает; повтор update_id ничего не делает", async () => {
    const attempt = await start();
    const id = (updateId += 1);
    const [reply] = await webhook(startMessage(attempt.challenge), id);
    expect(reply?.method).toBe("sendMessage");
    expect(JSON.stringify(reply)).toContain(attempt.code);
    expect(JSON.stringify(reply)).toContain(`ok:${attempt.id}`);
    expect(await webhook(startMessage(attempt.challenge), id)).toEqual([]);
    expect(await statusOf(attempt.id)).toBe("pending");
    expect((await completeLogin(hashToken(attempt.binding), ctx.ownerTelegramId)).state).toBe("pending");
  });

  it("чужой аккаунт: общий ответ раз в час, в БД не пишется, кнопка не срабатывает", async () => {
    const attempt = await start();
    const id = (updateId += 1);
    const [reply] = await webhook(startMessage(attempt.challenge, OWNER + 1), id);
    expect(JSON.stringify(reply)).not.toContain(attempt.code);
    expect(await webhook(startMessage(attempt.challenge, OWNER + 1))).toEqual([]);
    expect(await getDb().select().from(telegramUpdates).where(eq(telegramUpdates.updateId, id))).toEqual([]);
    const [answer] = await webhook(press(`ok:${attempt.id}`, OWNER + 1));
    expect(answer).toMatchObject({ method: "answerCallbackQuery", params: { text: "Недоступно" } });
    expect(await statusOf(attempt.id)).toBe("pending");
  });

  it("«Подтвердить» — одна сессия даже при гонке двух вкладок; повторное нажатие уже не действует", async () => {
    const attempt = await start();
    const [first, second] = await Promise.all([webhook(press(`ok:${attempt.id}`)), webhook(press(`ok:${attempt.id}`))]);
    const confirmed = [first, second].filter((calls) => JSON.stringify(calls).includes("Вход подтверждён"));
    expect(confirmed).toHaveLength(1);
    const binding = hashToken(attempt.binding);
    const results = await Promise.all([completeLogin(binding, ctx.ownerTelegramId), completeLogin(binding, ctx.ownerTelegramId)]);
    const signedIn = results.filter((r) => r.state === "signed-in");
    expect(signedIn).toHaveLength(1);
    // Проигравшая вкладка не получает «попытка закончилась»: её следующий опрос увидит общую сессию.
    expect(results.filter((r) => r.state === "pending")).toHaveLength(1);
    const session = signedIn[0];
    if (session?.state !== "signed-in") throw new Error("нет сессии");
    expect((await findSession(session.token, ctx.ownerTelegramId))?.displayName).toBe("@author");
    expect((await completeLogin(binding, ctx.ownerTelegramId)).state).toBe("pending");
  });

  it("подтвердил прежний владелец, а OWNER_TELEGRAM_ID сменили — вход не завершается, сессии нет", async () => {
    const attempt = await start();
    await webhook(press(`ok:${attempt.id}`));
    expect((await completeLogin(hashToken(attempt.binding), BigInt(OWNER + 5))).state).toBe("none");
    const sessions = await getDb().select().from(ownerSessions).where(eq(ownerSessions.telegramId, BigInt(OWNER + 5)));
    expect(sessions).toEqual([]);
  });

  it("«Это не я» отменяет вход; просроченный вызов не подтверждается", async () => {
    const rejected = await start();
    await webhook(press(`no:${rejected.id}`));
    expect((await completeLogin(hashToken(rejected.binding), ctx.ownerTelegramId)).state).toBe("rejected");

    const old = await start();
    await getDb().update(challenges).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(challenges.id, old.id));
    const [reply] = await webhook(startMessage(old.challenge));
    expect(JSON.stringify(reply)).toContain("устарела");
    await webhook(press(`ok:${old.id}`));
    expect(await statusOf(old.id)).toBe("pending");
    expect((await completeLogin(hashToken(old.binding), ctx.ownerTelegramId)).state).toBe("expired");
  });

  it("сессия: токен в БД только хешем; отозванная, просроченная и после смены владельца — не пускает", async () => {
    const owner = { telegramId: BigInt(OWNER), displayName: null };
    const a = await createSession(owner);
    const b = await createSession(owner);
    expect(a.token).not.toBe(b.token);
    const [row] = await getDb().select().from(ownerSessions).where(eq(ownerSessions.tokenHash, hashToken(a.token)));
    expect(JSON.stringify(row, (_k, v: unknown) => (typeof v === "bigint" ? String(v) : v))).not.toContain(a.token);

    const found = await findSession(a.token, BigInt(OWNER));
    expect(found).not.toBeNull();
    expect(await findSession(a.token, BigInt(OWNER + 1))).toBeNull();
    await revokeSession(found?.sessionId ?? "");
    expect(await findSession(a.token, BigInt(OWNER))).toBeNull();

    await getDb().update(ownerSessions).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(ownerSessions.tokenHash, hashToken(b.token)));
    expect(await findSession(b.token, BigInt(OWNER))).toBeNull();
  });

  it("роль рантайма пишет в таблицы входа, но не меняет их схему", async () => {
    await expect(getSql()`alter table owner_sessions add column probe int`).rejects.toThrow(/must be owner|permission denied/);
    await expect(getSql()`select count(*) from telegram_updates`).resolves.toBeDefined();
  });
});
