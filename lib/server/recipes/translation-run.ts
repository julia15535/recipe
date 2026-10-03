import "server-only";
import { revalidateTag } from "next/cache";

import { translateWithAi } from "@/lib/server/ai/translate-recipe";
import { sourceRecipeSchema, translationBodySchema } from "@/lib/server/ai/translate-schema";
import { allow } from "@/lib/server/auth/rate-limit";
import { type AiConfig, getAiConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";

import { PUBLIC_TAGS } from "./public-cache";
import { type Claimed, claimJob, failJob, finishJob, releaseJob } from "./translation-jobs";
import { failExhausted, markRevalidated, pendingWork } from "./translation-queue";

// Выполнение перевода (ADR-0029): по одному за раз на процесс; после записи — сброс кэша сайта
// (`revalidateTag(…, { expire: 0 })`: `updateTag` вне Server Action нельзя). Запускается из `after()` действия
// кабинета и подборщиком раз в минуту (`/api/jobs/translations`).
type Deps = { translate?: typeof translateWithAi; config?: AiConfig | null };
let chain: Promise<void> = Promise.resolve();

/** `deps` — для тестов: свой «переводчик» и настройки ИИ. */
export function runJob(jobId: string, deps: Deps = {}): Promise<void> {
  chain = chain.then(() => run(jobId, deps)).catch((error: unknown) => log.error("перевод не выполнен", { error: error instanceof Error ? error.name : "unknown" }));
  return chain;
}

async function run(jobId: string, deps: Deps): Promise<void> {
  const claimed = await claimJob(jobId);
  if (!claimed) return;
  try {
    await attempt(jobId, claimed, deps);
  } catch (error) {
    // Сбой БД при записи и т. п.: задание — неудача (не «переводится» навсегда), прежний перевод на месте.
    await failJob(jobId, claimed.token, "error");
    throw error;
  }
}

async function attempt(jobId: string, claimed: Claimed, { translate = translateWithAi, config = getAiConfig() }: Deps): Promise<void> {
  const { token, recipeId } = claimed;
  const source = sourceRecipeSchema.safeParse(claimed.input);
  if (!source.success) return failJob(jobId, token, "input");
  if (!config) return failJob(jobId, token, "disabled");
  if (!allow("recipe-translate", 60, 60 * 60 * 1000)) return releaseJob(jobId, token);
  const result = await translate(source.data, config);
  if (!result.ok) {
    log.warn("перевод: отказ", { reason: result.reason });
    return failJob(jobId, token, result.reason);
  }
  const body = translationBodySchema.safeParse(result.body);
  if (!body.success) return failJob(jobId, token, "body");
  const saved = { head: result.head, body: result.body, sourceContentRevision: claimed.sourceContentRevision, model: result.model, promptVersion: result.promptVersion };
  if (await finishJob(jobId, token, recipeId, saved)) await revalidatePublic([jobId]);
}

/** Сайт сразу показывает перевод: списки, разделы, поиск и сам рецепт. */
export async function revalidatePublic(jobIds: string[]): Promise<void> {
  try {
    for (const tag of PUBLIC_TAGS) revalidateTag(tag, { expire: 0 });
  } catch (error) {
    // Вне контекста запроса Next (тесты) — не отмечаем: подборщик досбросит кэш.
    log.warn("перевод: кэш сайта не сброшен", { error: error instanceof Error ? error.name : "unknown" });
    return;
  }
  await markRevalidated(jobIds);
}

/** Подборщик: прерванные и забытые задания, недосброшенный кэш. */
export async function pickupTranslations(): Promise<void> {
  await failExhausted();
  const work = await pendingWork();
  for (const id of work.run) await runJob(id);
  if (work.revalidate.length) await revalidatePublic(work.revalidate);
}
