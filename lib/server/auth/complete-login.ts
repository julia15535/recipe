import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { ownerLoginChallenges as challenges } from "@/lib/server/db/schema";

import { createSession } from "./session";
import { guarded } from "./storage-error";

export type LoginState = "pending" | "expired" | "rejected" | "none";
export type CompleteResult = { state: "signed-in"; token: string; expiresAt: Date } | { state: LoginState; code?: string };

/**
 * Завершение входа по привязке браузера (не по challenge). Подтверждённый вызов атомарно
 * помечается «использован» и превращается в новую сессию — второй запрос сессию уже не получит.
 */
export function completeLogin(bindingHash: Buffer, ownerTelegramId: bigint): Promise<CompleteResult> {
  return guarded(() => consume(bindingHash, ownerTelegramId));
}

async function consume(bindingHash: Buffer, ownerTelegramId: bigint): Promise<CompleteResult> {
  return getDb().transaction(async (tx) => {
    const [used] = await tx
      .update(challenges)
      .set({ status: "consumed", consumedAt: sql`now()` })
      .where(
        and(eq(challenges.bindingHash, bindingHash), eq(challenges.status, "confirmed"), gt(challenges.expiresAt, sql`now()`)),
      )
      .returning({ telegramId: challenges.telegramId, displayName: challenges.displayName });
    if (used) {
      // Подтвердил не текущий владелец (OWNER_TELEGRAM_ID сменили по ходу) — входа нет.
      if (used.telegramId !== ownerTelegramId) return { state: "none" };
      const session = await createSession({ telegramId: ownerTelegramId, displayName: used.displayName }, tx);
      return { state: "signed-in", ...session };
    }
    const [row] = await tx
      .select({ status: challenges.status, code: challenges.code, live: sql<boolean>`${challenges.expiresAt} > now()` })
      .from(challenges)
      .where(eq(challenges.bindingHash, bindingHash));
    if (!row) return { state: "none" };
    if (row.status === "rejected") return { state: "rejected" };
    if (row.status === "pending" || row.status === "confirmed") {
      return row.live ? { state: "pending", code: row.code } : { state: "expired" };
    }
    // Другая вкладка этого браузера только что вошла: cookie сессии у них общая — следующий опрос
    // её увидит. Не конец попытки, а «ещё чуть-чуть».
    if (row.status === "consumed" && row.live) return { state: "pending" };
    return { state: "none" };
  });
}
