import "server-only";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { articleSource, type SavedArticleTranslation, writeArticleTranslation } from "./translation-store";

// Очередь переводов статей (ADR-0038) — по образцу рецептов (`lib/server/recipes/translation-jobs.ts`, ADR-0029), своя
// таблица: задание держит снимок русской статьи; перевод — после ответа владельцу (`after()`) или подборщиком; результат
// пишет только владелец аренды (token). Аренда длиннее таймаута запроса к ИИ (90 с) — две копии не переведут одно.
const LEASE_SECONDS = 180;
export const ARTICLE_MAX_ATTEMPTS = 3;
const jobs = t.articleTranslationJobs;

/** Поставить перевод. `force` — «Перевести заново»; без него — только если перевода ещё нет. Активное не дублируется. */
export function enqueueArticleTranslation(articleId: string, force: boolean): Promise<string | null> {
  return guarded("перевод", () =>
    getDb().transaction(async (tx) => {
      await tx.select({ id: t.articles.id }).from(t.articles).where(eq(t.articles.id, articleId)).for("update");
      const [active] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.articleId, articleId), inArray(jobs.status, ["queued", "running"])));
      if (active) return active.id;
      if (!force) {
        const [ready] = await tx.select({ id: t.articleTranslations.articleId }).from(t.articleTranslations).where(eq(t.articleTranslations.articleId, articleId));
        if (ready) return null;
      }
      const snapshot = await articleSource(tx, articleId);
      if (!snapshot) return null;
      const id = crypto.randomUUID();
      await tx.insert(jobs).values({ id, articleId, locale: "en", input: snapshot.source, sourceContentRevision: snapshot.contentRevision });
      return id;
    }),
  );
}

export type ClaimedArticle = { token: string; articleId: string; input: unknown; sourceContentRevision: number };

/** Взять задание в работу: свободное или с истёкшей арендой, не больше трёх захватов. */
export async function claimArticleJob(jobId: string): Promise<ClaimedArticle | null> {
  const token = crypto.randomUUID();
  const [row] = await guarded("перевод", () =>
    getDb()
      .update(jobs)
      .set({ status: "running", token, leaseUntil: sql`now() + make_interval(secs => ${LEASE_SECONDS})`, attempts: sql`${jobs.attempts} + 1` })
      .where(
        and(
          eq(jobs.id, jobId),
          lt(jobs.attempts, ARTICLE_MAX_ATTEMPTS),
          or(eq(jobs.status, "queued"), and(eq(jobs.status, "running"), lt(jobs.leaseUntil, sql`now()`))),
        ),
      )
      .returning({ articleId: jobs.articleId, input: jobs.input, sourceContentRevision: jobs.sourceContentRevision }),
  );
  return row ? { token, ...row } : null;
}

const owned = (jobId: string, token: string) => and(eq(jobs.id, jobId), eq(jobs.token, token), eq(jobs.status, "running"));

export function failArticleJob(jobId: string, token: string, error: string): Promise<void> {
  return guarded("перевод", async () => {
    await getDb().update(jobs).set({ status: "failed", error: error.slice(0, 200), finishedAt: sql`now()`, leaseUntil: null }).where(owned(jobId, token));
  });
}

/** Отдать задание обратно в очередь (лимит частоты) — без попытки. */
export function releaseArticleJob(jobId: string, token: string): Promise<void> {
  return guarded("перевод", async () => {
    await getDb().update(jobs).set({ status: "queued", token: null, leaseUntil: null, attempts: sql`${jobs.attempts} - 1` }).where(owned(jobId, token));
  });
}

/** Записать перевод, если задание всё ещё наше; false — устарело (переставили, статью удалили). */
export function finishArticleJob(jobId: string, token: string, articleId: string, saved: SavedArticleTranslation): Promise<boolean> {
  return guarded("перевод", () =>
    getDb().transaction(async (tx) => {
      const [job] = await tx.select({ id: jobs.id }).from(jobs).where(owned(jobId, token)).for("update");
      if (!job) return false;
      await writeArticleTranslation(tx, articleId, saved);
      await tx.update(jobs).set({ status: "done", finishedAt: sql`now()`, leaseUntil: null, error: null }).where(eq(jobs.id, jobId));
      return true;
    }),
  );
}
