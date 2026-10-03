import "server-only";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

// Очередь переводов — чтение (ADR-0029): что подобрать после перезапуска, у чего досбросить кэш сайта, что показать
// в кабинете. Запись заданий — `translation-jobs.ts`.
import { MAX_ATTEMPTS } from "./translation-jobs";

/** Задания для подборщика: ждущие дольше 30 с и с истёкшей арендой; готовые, у которых не сброшен кэш сайта. */
export function pendingWork(): Promise<{ run: string[]; revalidate: string[] }> {
  return guarded("перевод", async () => {
    const db = getDb();
    const [run, revalidate] = await Promise.all([
      db
        .select({ id: t.recipeTranslationJobs.id })
        .from(t.recipeTranslationJobs)
        .where(
          and(
            lt(t.recipeTranslationJobs.attempts, MAX_ATTEMPTS),
            or(
              // Свежее задание обычно уже берёт `after()`; захват по token не даст выполнить его дважды.
              and(eq(t.recipeTranslationJobs.status, "queued"), lt(t.recipeTranslationJobs.createdAt, sql`now() - interval '5 seconds'`)),
              and(eq(t.recipeTranslationJobs.status, "running"), lt(t.recipeTranslationJobs.leaseUntil, sql`now()`)),
            ),
          ),
        )
        .orderBy(t.recipeTranslationJobs.createdAt)
        .limit(3),
      db
        .select({ id: t.recipeTranslationJobs.id })
        .from(t.recipeTranslationJobs)
        .where(and(eq(t.recipeTranslationJobs.status, "done"), isNull(t.recipeTranslationJobs.revalidatedAt)))
        .limit(20),
    ]);
    return { run: run.map((row) => row.id), revalidate: revalidate.map((row) => row.id) };
  });
}

/** Процесс умер на последней попытке: такое задание больше никто не возьмёт — неудача, кнопка «Перевести заново». */
export function failExhausted(): Promise<void> {
  return guarded("перевод", async () => {
    await getDb()
      .update(t.recipeTranslationJobs)
      .set({ status: "failed", error: "lease", finishedAt: sql`now()`, leaseUntil: null, token: null })
      .where(
        and(
          eq(t.recipeTranslationJobs.status, "running"),
          lt(t.recipeTranslationJobs.leaseUntil, sql`now()`),
          sql`${t.recipeTranslationJobs.attempts} >= ${MAX_ATTEMPTS}`,
        ),
      );
  });
}

export function markRevalidated(jobIds: string[]): Promise<void> {
  return guarded("перевод", async () => {
    if (jobIds.length) await getDb().update(t.recipeTranslationJobs).set({ revalidatedAt: sql`now()` }).where(inArray(t.recipeTranslationJobs.id, jobIds));
  });
}

export type TranslationState = {
  slug: string | null;
  outdated: boolean;
  job: { status: "queued" | "running" | "done" | "failed"; error: string | null } | null;
};

/** Для кабинета: есть ли перевод, устарел ли (русский меняли после него), последнее задание. */
export function translationState(recipeId: string): Promise<TranslationState> {
  return guarded("перевод", async () => {
    const db = getDb();
    const [[ready], [job]] = await Promise.all([
      db
        .select({ slug: t.recipeLocalizations.slug, source: t.recipeTranslations.sourceContentRevision, content: t.recipes.contentRevision })
        .from(t.recipeTranslations)
        .innerJoin(t.recipeLocalizations, and(eq(t.recipeLocalizations.recipeId, t.recipeTranslations.recipeId), eq(t.recipeLocalizations.locale, "en")))
        .innerJoin(t.recipes, eq(t.recipes.id, t.recipeTranslations.recipeId))
        .where(eq(t.recipeTranslations.recipeId, recipeId)),
      db
        .select({ status: t.recipeTranslationJobs.status, error: t.recipeTranslationJobs.error })
        .from(t.recipeTranslationJobs)
        .where(eq(t.recipeTranslationJobs.recipeId, recipeId))
        .orderBy(desc(t.recipeTranslationJobs.createdAt))
        .limit(1),
    ]);
    return { slug: ready?.slug ?? null, outdated: ready ? ready.source !== ready.content : false, job: job ?? null };
  });
}

