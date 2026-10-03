import "server-only";
import { after } from "next/server";

import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";

import { enqueueTranslation } from "./translation-jobs";
import { runJob } from "./translation-run";

/**
 * Из действия кабинета: поставить перевод и выполнить его после ответа владельцу (публикация не ждёт ИИ ~10 с).
 * Сбой постановки не отменяет публикацию — владелец увидит «перевода нет» и нажмёт «Перевести».
 */
export async function translateLater(recipeId: string, force: boolean): Promise<boolean> {
  try {
    const jobId = await enqueueTranslation(recipeId, force);
    if (jobId) after(() => runJob(jobId));
    return true;
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("перевод не поставлен", { pg: error.code });
    return false;
  }
}
