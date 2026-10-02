import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { type Executor, getDb } from "@/lib/server/db/client";
import { ownerSessions } from "@/lib/server/db/schema";

import { guarded } from "./storage-error";
import { hashToken, newToken, SESSION_TTL_MS } from "./tokens";

export type OwnerSession = { sessionId: string; telegramId: bigint; displayName: string | null };

/** Новая сессия: в БД — только хеш токена; срок ровно 30 дней, без продления. */
export async function createSession(
  owner: { telegramId: bigint; displayName: string | null },
  db: Executor = getDb(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(ownerSessions).values({
    tokenHash: hashToken(token),
    telegramId: owner.telegramId,
    displayName: owner.displayName,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Живая сессия текущего владельца: не просрочена, не отозвана, id совпадает с OWNER_TELEGRAM_ID. */
export async function findSession(token: string, ownerTelegramId: bigint, db: Executor = getDb()): Promise<OwnerSession | null> {
  const [row] = await guarded(() =>
    db
      .select({ sessionId: ownerSessions.id, telegramId: ownerSessions.telegramId, displayName: ownerSessions.displayName })
      .from(ownerSessions)
      .where(
        and(
          eq(ownerSessions.tokenHash, hashToken(token)),
          isNull(ownerSessions.revokedAt),
          gt(ownerSessions.expiresAt, sql`now()`),
          eq(ownerSessions.telegramId, ownerTelegramId),
        ),
      ),
  );
  return row ?? null;
}

export async function revokeSession(sessionId: string, db: Executor = getDb()): Promise<void> {
  await guarded(() =>
    db
      .update(ownerSessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(ownerSessions.id, sessionId), isNull(ownerSessions.revokedAt))),
  );
}
