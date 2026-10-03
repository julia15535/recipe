import "server-only";

import { allow } from "@/lib/server/auth/rate-limit";
import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";

import { PhotoError } from "./process";

// Обработка фото — одна на весь сервер (0,25 CPU, 384 МБ): вторая сразу получает «подождите», а не очередь
// буферизованных запросов; не больше 30 за час. Ошибки — понятными фразами для владельца (ADR-0028).
export type PhotoResult = { ok: true } | { ok: false; message: string };

const MESSAGES = {
  format: "Такой формат не подходит — выберите фото JPEG, PNG или WebP.",
  broken: "Не получилось открыть фото — попробуйте другое.",
  large: "Фото слишком большое — выберите другое.",
  small: "Фото слишком маленькое для такого увеличения — уменьшите масштаб или выберите снимок побольше.",
  busy: "Подождите — сейчас сохраняется другое фото.",
  limit: "Слишком много фото за час — попробуйте позже.",
  conflict: "Фото уже изменили в другой вкладке — обновите страницу.",
  "not-found": "Рецепт не найден — возможно, его удалили.",
  storage: "Не получилось сохранить — попробуйте ещё раз.",
} as const;
export const fail = (reason: keyof typeof MESSAGES): PhotoResult => ({ ok: false, message: MESSAGES[reason] });

let processing = false;

export async function exclusive(work: () => Promise<PhotoResult>): Promise<PhotoResult> {
  if (processing) return fail("busy");
  if (!allow("recipe-photo", 30, 60 * 60 * 1000)) return fail("limit");
  processing = true;
  try {
    return await work();
  } catch (error) {
    if (error instanceof PhotoError) return fail(error.reason);
    if (!(error instanceof StorageError)) throw error;
    log.error("фото не сохранено", { pg: error.code });
    return fail("storage");
  } finally {
    processing = false;
  }
}

