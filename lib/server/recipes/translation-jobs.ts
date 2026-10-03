import "server-only";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { sourceSnapshot, writeTranslation } from "./translation-store";

// Очередь переводов в Postgres (ADR-0029): задание держит снимок русского рецепта на момент постановки; перевод
// идёт после ответа владельцу (`after()`) и подбирается заново, если процесс умер (аренда истекла). Результат
// пишется только владельцем аренды (token) — поздний ответ старого задания ничего не перетирает.
const LEASE_SECONDS = 120;
export const MAX_ATTEMPTS = 3;

/**
 * Поставить перевод. `force` — «Перевести заново»: даже если готовый перевод есть. Без `force` (публикация) —
 * только если перевода ещё нет. Активное задание не дублируется. Возвращает id задания или null.
 */
export function enqueueTranslation(recipeId: string, force: boolean): Promise<string | null> {
  return guarded("перевод", () =>
    getDb().transaction(async (tx) => {
      await tx.select({ id: t.recipes.id }).from(t.recipes).where(eq(t.recipes.id, recipeId)).for("update");
      const [active] = await tx
        .select({ id: t.recipeTranslationJobs.id })
        .from(t.recipeTranslationJobs)
        .where(and(eq(t.recipeTranslationJobs.recipeId, recipeId), inArray(t.recipeTranslationJobs.status, ["queued", "running"])));
      if (active) return active.id;
      if (!force) {
        const [ready] = await tx.select({ id: t.recipeTranslations.recipeId }).from(t.recipeTranslations).where(eq(t.recipeTranslations.recipeId, recipeId));
        if (ready) return null;
      }
      const snapshot = await sourceSnapshot(tx, recipeId);
      if (!snapshot) return null;
      const id = crypto.randomUUID();
      await tx.insert(t.recipeTranslationJobs).values({ id, recipeId, locale: "en", input: snapshot.source, sourceContentRevision: snapshot.contentRevision });
      return id;
    }),
  );
}

export type Claimed = { token: string; recipeId: string; input: unknown; sourceContentRevision: number };

/** Взять задание в работу: свободное или с истёкшей арендой, не больше трёх попыток. */
export async function claimJob(jobId: string): Promise<Claimed | null> {
  const token = crypto.randomUUID();
  const [row] = await guarded("перевод", () =>
    getDb()
      .update(t.recipeTranslationJobs)
      .set({ status: "running", token, leaseUntil: sql`now() + make_interval(secs => ${LEASE_SECONDS})`, attempts: sql`${t.recipeTranslationJobs.attempts} + 1` })
      .where(
        and(
          eq(t.recipeTranslationJobs.id, jobId),
          lt(t.recipeTranslationJobs.attempts, MAX_ATTEMPTS),
          or(eq(t.recipeTranslationJobs.status, "queued"), and(eq(t.recipeTranslationJobs.status, "running"), lt(t.recipeTranslationJobs.leaseUntil, sql`now()`))),
        ),
      )
      .returning({ recipeId: t.recipeTranslationJobs.recipeId, input: t.recipeTranslationJobs.input, sourceContentRevision: t.recipeTranslationJobs.sourceContentRevision }),
  );
  return row ? { token, ...row } : null;
}

const owned = (jobId: string, token: string) => and(eq(t.recipeTranslationJobs.id, jobId), eq(t.recipeTranslationJobs.token, token), eq(t.recipeTranslationJobs.status, "running"));

export function failJob(jobId: string, token: string, error: string): Promise<void> {
  return guarded("перевод", async () => {
    await getDb().update(t.recipeTranslationJobs).set({ status: "failed", error: error.slice(0, 200), finishedAt: sql`now()`, leaseUntil: null }).where(owned(jobId, token));
  });
}

/** Отдать задание обратно в очередь (лимит частоты) — без попытки. */
export function releaseJob(jobId: string, token: string): Promise<void> {
  return guarded("перевод", async () => {
    await getDb()
      .update(t.recipeTranslationJobs)
      .set({ status: "queued", token: null, leaseUntil: null, attempts: sql`${t.recipeTranslationJobs.attempts} - 1` })
      .where(owned(jobId, token));
  });
}

type Result = Parameters<typeof writeTranslation>[2];

/** Записать перевод, если задание всё ещё наше; false — устарело (переставили, рецепт удалён). */
export function finishJob(jobId: string, token: string, recipeId: string, result: Result): Promise<boolean> {
  return guarded("перевод", () =>
    getDb().transaction(async (tx) => {
      const [job] = await tx.select({ id: t.recipeTranslationJobs.id }).from(t.recipeTranslationJobs).where(owned(jobId, token)).for("update");
      if (!job) return false;
      await writeTranslation(tx, recipeId, result);
      await tx.update(t.recipeTranslationJobs).set({ status: "done", finishedAt: sql`now()`, leaseUntil: null, error: null }).where(eq(t.recipeTranslationJobs.id, jobId));
      return true;
    }),
  );
}
