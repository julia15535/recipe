import "server-only";
import { and, desc, eq, inArray, isNull, lt, notExists, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";
import type { TranslationState } from "@/lib/server/recipes/translation-queue";

import { ARTICLE_MAX_ATTEMPTS } from "./translation-jobs";

// Очередь переводов статей — чтение (ADR-0038), как у рецептов: что подобрать, у чего досбросить кэш, что показать в
// кабинете; плюс опубликованные статьи, которым перевод ещё ни разу не ставили (две статьи, опубликованные до перевода).
const jobs = t.articleTranslationJobs;

/** Задания для подборщика: ждущие дольше 5 с и с истёкшей арендой (по одному — статья долгая); готовые без сброса кэша. */
export function pendingArticleWork(): Promise<{ run: string[]; revalidate: string[] }> {
  return guarded("перевод", async () => {
    const db = getDb();
    const [run, revalidate] = await Promise.all([
      db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            lt(jobs.attempts, ARTICLE_MAX_ATTEMPTS),
            or(
              and(eq(jobs.status, "queued"), lt(jobs.createdAt, sql`now() - interval '5 seconds'`)),
              and(eq(jobs.status, "running"), lt(jobs.leaseUntil, sql`now()`)),
            ),
          ),
        )
        .orderBy(jobs.createdAt)
        .limit(1),
      db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.status, "done"), isNull(jobs.revalidatedAt)))
        .limit(20),
    ]);
    return { run: run.map((row) => row.id), revalidate: revalidate.map((row) => row.id) };
  });
}

/** Опубликованные статьи без перевода, которым задание не ставили ни разу, — перевод ставит подборщик (раз в жизни). */
export function neverTranslated(): Promise<string[]> {
  return guarded("перевод", async () => {
    const rows = await getDb()
      .select({ id: t.articles.id })
      .from(t.articles)
      .where(
        and(
          eq(t.articles.status, "published"),
          notExists(getDb().select({ one: sql`1` }).from(jobs).where(eq(jobs.articleId, t.articles.id))),
          notExists(getDb().select({ one: sql`1` }).from(t.articleTranslations).where(eq(t.articleTranslations.articleId, t.articles.id))),
        ),
      )
      .limit(5);
    return rows.map((row) => row.id);
  });
}

/** Процесс умер на последней попытке: задание больше никто не возьмёт — неудача, кнопка «Перевести заново». */
export function failExhaustedArticles(): Promise<void> {
  return guarded("перевод", async () => {
    await getDb()
      .update(jobs)
      .set({ status: "failed", error: "lease", finishedAt: sql`now()`, leaseUntil: null, token: null })
      .where(and(eq(jobs.status, "running"), lt(jobs.leaseUntil, sql`now()`), sql`${jobs.attempts} >= ${ARTICLE_MAX_ATTEMPTS}`));
  });
}

export function markArticlesRevalidated(jobIds: string[]): Promise<void> {
  return guarded("перевод", async () => {
    if (jobIds.length) await getDb().update(jobs).set({ revalidatedAt: sql`now()` }).where(inArray(jobs.id, jobIds));
  });
}

/** Для кабинета — одним запросом (один снимок базы, как у рецептов): перевод, устарел ли, последнее задание. */
export function articleTranslationState(articleId: string): Promise<TranslationState> {
  return guarded("перевод", async () => {
    const db = getDb();
    const job = db
      .select({ status: jobs.status, error: jobs.error })
      .from(jobs)
      .where(and(eq(jobs.articleId, t.articles.id), eq(jobs.locale, "en")))
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .limit(1)
      .as("last_job");
    const [row] = await db
      .select({
        slug: t.articleLocalizations.slug,
        source: t.articleTranslations.sourceContentRevision,
        content: t.articles.contentRevision,
        jobStatus: job.status,
        jobError: job.error,
      })
      .from(t.articles)
      .leftJoin(t.articleTranslations, and(eq(t.articleTranslations.articleId, t.articles.id), eq(t.articleTranslations.locale, "en")))
      .leftJoin(t.articleLocalizations, and(eq(t.articleLocalizations.articleId, t.articles.id), eq(t.articleLocalizations.locale, "en")))
      .leftJoinLateral(job, sql`true`)
      .where(eq(t.articles.id, articleId));
    const ready = row && row.source !== null && row.slug !== null ? { slug: row.slug, outdated: row.source !== row.content } : null;
    return {
      slug: ready?.slug ?? null,
      outdated: ready?.outdated ?? false,
      job: row?.jobStatus ? { status: row.jobStatus, error: row.jobError ?? null } : null,
    };
  });
}
