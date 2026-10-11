import "server-only";
import { after } from "next/server";

import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";

import { enqueueArticleTranslation } from "./translation-jobs";
import { runArticleJob } from "./translation-run";

/**
 * Из действия кабинета (ADR-0038): поставить перевод статьи и выполнить его после ответа владельцу. Сбой постановки не
 * отменяет публикацию — подборщик поставит перевод сам (статья без заданий), или владелец нажмёт «Перевести».
 */
export async function translateArticleLater(articleId: string, force: boolean): Promise<boolean> {
  try {
    const jobId = await enqueueArticleTranslation(articleId, force);
    if (jobId) after(() => runArticleJob(jobId));
    return true;
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("перевод статьи не поставлен", { pg: error.code });
    return false;
  }
}
