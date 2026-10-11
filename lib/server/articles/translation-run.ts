import "server-only";

import { translateArticleWithAi } from "@/lib/server/ai/translate-article";
import { allow } from "@/lib/server/auth/rate-limit";
import { type AiConfig, getAiConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { revalidateSite, serially } from "@/lib/server/recipes/translation-run";

import { type ClaimedArticle, claimArticleJob, enqueueArticleTranslation, failArticleJob, finishArticleJob, releaseArticleJob } from "./translation-jobs";
import { failExhaustedArticles, markArticlesRevalidated, neverTranslated, pendingArticleWork } from "./translation-queue";
import { articleSourceSchema, translatedArticleSchema } from "./translation-schema";

// Выполнение перевода статьи (ADR-0038): в общей с рецептами очереди исполнения (по одному на процесс), общий часовой
// лимит переводов; после записи — сброс кэша сайта. Запуск — `after()` действия кабинета и подборщик раз в минуту.
type Deps = { translate?: typeof translateArticleWithAi; config?: AiConfig | null };
const HOUR = 60 * 60 * 1000;
// Подборщик обрывается через 170 с, перевод статьи — до 90 с: новую статью берём, только если с начала прошло < 60 с.
const PICKUP_BUDGET_MS = 60_000;

export function runArticleJob(jobId: string, deps: Deps = {}): Promise<void> {
  return serially(() => run(jobId, deps));
}

async function run(jobId: string, deps: Deps): Promise<void> {
  const claimed = await claimArticleJob(jobId);
  if (!claimed) return;
  try {
    await attempt(jobId, claimed, deps);
  } catch (error) {
    await failArticleJob(jobId, claimed.token, "error");
    throw error;
  }
}

async function attempt(jobId: string, claimed: ClaimedArticle, { translate = translateArticleWithAi, config = getAiConfig() }: Deps): Promise<void> {
  const { token, articleId } = claimed;
  const source = articleSourceSchema.safeParse(claimed.input);
  if (!source.success) return failArticleJob(jobId, token, "input");
  if (!config) return failArticleJob(jobId, token, "disabled");
  if (!allow("recipe-translate", 60, HOUR)) return releaseArticleJob(jobId, token);
  const result = await translate(source.data, config);
  if (!result.ok) {
    log.warn("перевод статьи: отказ", { reason: result.reason });
    return failArticleJob(jobId, token, result.reason);
  }
  const article = translatedArticleSchema.safeParse(result.article);
  if (!article.success) return failArticleJob(jobId, token, "body");
  const saved = { article: article.data, sourceContentRevision: claimed.sourceContentRevision, model: result.model, promptVersion: result.promptVersion };
  if (await finishArticleJob(jobId, token, articleId, saved)) await revalidateArticles([jobId]);
}

async function revalidateArticles(jobIds: string[]): Promise<void> {
  if (revalidateSite()) await markArticlesRevalidated(jobIds);
}

/** Подборщик статей: прерванные задания, статьи без перевода (раз в жизни), недосброшенный кэш. */
export async function pickupArticleTranslations(started: number): Promise<void> {
  await failExhaustedArticles();
  for (const id of await neverTranslated()) await enqueueArticleTranslation(id, false);
  const work = await pendingArticleWork();
  if (Date.now() - started < PICKUP_BUDGET_MS) for (const id of work.run) await runArticleJob(id);
  if (work.revalidate.length) await revalidateArticles(work.revalidate);
}
