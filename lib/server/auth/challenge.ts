import "server-only";
import { and, count, eq, gt, inArray, sql } from "drizzle-orm";

import { type Executor, getDb } from "@/lib/server/db/client";
import { ownerLoginChallenges } from "@/lib/server/db/schema";

import { pruneExpired } from "./prune";
import { guarded } from "./storage-error";
import { CHALLENGE_TTL_MS, hashToken, newDisplayCode, newToken } from "./tokens";

const challenges = ownerLoginChallenges;

/**
 * Не больше `perIp` вызовов с одного адреса за 10 минут и `pending` живых вызовов всего. Общий
 * предел — от засорения БД; поднят так, чтобы закрыть вход владельцу могла только сотня адресов.
 */
export const LOGIN_LIMITS = { perIp: 20, pending: 2000 };

export type ActiveChallenge = { id: string; code: string; status: "pending" | "confirmed"; challengeHash: Buffer };
export type StartResult =
  | { ok: true; binding: string; challenge: string; code: string; expiresAt: Date }
  | { ok: false; reason: "rate-limited" };

/** Живой (не просроченный, ещё не использованный) вызов этой привязки — для второй вкладки. */
export async function findActiveByBinding(bindingHash: Buffer, db: Executor = getDb()): Promise<ActiveChallenge | null> {
  const [row] = await guarded(() =>
    db
      .select({ id: challenges.id, code: challenges.code, status: challenges.status, challengeHash: challenges.challengeHash })
      .from(challenges)
      .where(and(eq(challenges.bindingHash, bindingHash), gt(challenges.expiresAt, sql`now()`))),
  );
  if (!row || (row.status !== "pending" && row.status !== "confirmed")) return null;
  return { ...row, status: row.status };
}

/** Новый вызов: прежний (ожидающий или подтверждённый, но не использованный) вызов этой привязки отменяется. */
export function startChallenge(
  input: { ipHash: Buffer; previousBindingHash: Buffer | null },
  limits = LOGIN_LIMITS,
  db: Executor = getDb(),
): Promise<StartResult> {
  return guarded(() => createChallenge(input, limits, db));
}

async function createChallenge(
  input: { ipHash: Buffer; previousBindingHash: Buffer | null },
  limits: typeof LOGIN_LIMITS,
  db: Executor,
): Promise<StartResult> {
  const [byIp] = await db
    .select({ n: count() })
    .from(challenges)
    .where(and(eq(challenges.ipHash, input.ipHash), gt(challenges.createdAt, sql`now() - interval '10 minutes'`)));
  if ((byIp?.n ?? 0) >= limits.perIp) return { ok: false, reason: "rate-limited" };
  const [live] = await db
    .select({ n: count() })
    .from(challenges)
    .where(and(eq(challenges.status, "pending"), gt(challenges.expiresAt, sql`now()`)));
  if ((live?.n ?? 0) >= limits.pending) return { ok: false, reason: "rate-limited" };

  await pruneExpired(db);
  if (input.previousBindingHash) {
    await db
      .update(challenges)
      .set({ status: "cancelled" })
      .where(and(eq(challenges.bindingHash, input.previousBindingHash), inArray(challenges.status, ["pending", "confirmed"])));
  }
  const binding = newToken();
  const challenge = newToken();
  const code = newDisplayCode();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await db.insert(challenges).values({
    challengeHash: hashToken(challenge),
    bindingHash: hashToken(binding),
    code,
    ipHash: input.ipHash,
    expiresAt,
  });
  return { ok: true, binding, challenge, code, expiresAt };
}
