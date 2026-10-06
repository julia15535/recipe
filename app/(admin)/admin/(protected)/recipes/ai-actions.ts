"use server";

import { z } from "zod";

import { draftToView } from "@/components/recipe/from-draft";
import type { RecipeView } from "@/components/recipe/view";
import type { Check } from "@/lib/domain/recipe-text/ai-recipe";
import { toCanonicalText } from "@/lib/domain/recipe-text/canonical";
import { isSavable } from "@/lib/domain/recipe-text/from-ai";
import { byteLength, LIMITS } from "@/lib/domain/recipe-text/limits";
import { releaseAiTurn, takeAiTurn } from "@/lib/server/ai/one-at-a-time";
import { parseWithAi } from "@/lib/server/ai/parse-recipe";
import { requireOwner } from "@/lib/server/auth/owner";
import { allow } from "@/lib/server/auth/rate-limit";
import { StorageError } from "@/lib/server/db/errors";
import { getAiConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { catalogLabels, getCatalog } from "@/lib/server/recipes/catalog";
import { countArticleImportsLastHour } from "@/lib/server/articles/imports";
import { countImportsLastHour, dropImport, IMPORTS_PER_HOUR, loadImport, storeImport } from "@/lib/server/recipes/imports";
import { refreshPublicSite } from "@/lib/server/recipes/public-cache";
import { translateLater } from "@/lib/server/recipes/translate-later";
import { createRecipe, replaceRecipe } from "@/lib/server/recipes/save";

// ИИ-разбор рецепта (план recipe-ai-parse): «Разобрать» → черновик и «Проверьте»; «Сохранить» берёт разбор
// с сервера по id (структуре из браузера не доверяем, ИИ второй раз не зовём). Каждое действие — requireOwner().
export type AiParsed = { ok: true; importId: string; ready: boolean; checks: Check[]; view: RecipeView | null } | { ok: false; message: string };
export type AiSaved = { ok: true; id: string } | { ok: false; message: string };

const MESSAGES: Record<string, string> = {
  disabled: "Разбор через ИИ сейчас выключен — разберите по старому формату.",
  empty: "Вставьте текст рецепта.",
  "too-large": "Текст слишком длинный — больше 20 КБ. Сократите его.",
  limit: "Слишком много разборов за час — подождите немного.",
  busy: "Предыдущий разбор ещё идёт — подождите несколько секунд.",
  timeout: "ИИ думал слишком долго. Нажмите «Разобрать ещё раз».",
  network: "Не удалось связаться с ИИ. Нажмите «Разобрать ещё раз» или разберите по старому формату.",
  auth: "ИИ не принимает наш ключ — напишите мне, я проверю.",
  rate: "ИИ сейчас перегружен. Нажмите «Разобрать ещё раз» через минуту.",
  server: "У ИИ сбой. Нажмите «Разобрать ещё раз» через минуту.",
  "bad-response": "ИИ ответил непонятно. Нажмите «Разобрать ещё раз».",
  refusal: "ИИ отказался разбирать этот текст. Разберите по старому формату.",
  length: "Рецепт получился слишком длинным для одного разбора — сократите текст.",
  storage: "Не получилось сохранить разбор — нажмите ещё раз. Текст на месте.",
};

export async function aiParseRecipe(input: string): Promise<AiParsed> {
  await requireOwner();
  // NUL Postgres не примет — убираем до платного вызова ИИ.
  const text = z.string().catch("").parse(input).replaceAll("\u0000", "");
  const config = getAiConfig();
  if (!config) return { ok: false, message: MESSAGES.disabled ?? "" };
  if (!takeAiTurn()) return { ok: false, message: MESSAGES.busy ?? "" };
  try {
    // Лимит общий с разборами статей (ADR-0034): в памяти — ключ `ai-parse`, в БД — сумма разборов за час.
    const used = (await countImportsLastHour()) + (await countArticleImportsLastHour());
    if (used >= IMPORTS_PER_HOUR || !allow("ai-parse", IMPORTS_PER_HOUR, 60 * 60 * 1000)) {
      return { ok: false, message: MESSAGES.limit ?? "" };
    }
    const labels = catalogLabels(await getCatalog());
    const parsed = await parseWithAi(text, config, labels);
    if (!parsed.ok) return { ok: false, message: MESSAGES[parsed.reason] ?? MESSAGES.network ?? "" };
    const { result } = parsed;
    // Аккуратный текст рецепта должен поместиться в `source_text` (20 КБ) — иначе БД не примет сохранение.
    if (byteLength(toCanonicalText(result.draft, result.mainIndex, labels)) > LIMITS.bytes) {
      result.ok = false;
      result.checks.unshift({ group: "decide", text: "Рецепт получился слишком длинным (больше 20 КБ) — сократите текст." });
    }
    const importId = await storeImport(text, result);
    const view = draftToView({ ok: result.ok, draft: result.draft, mainIndex: result.mainIndex, issues: [] }, labels);
    return { ok: true, importId, ready: result.ok, checks: result.checks, view };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("ии: разбор не сохранён", { pg: error.code });
    return { ok: false, message: MESSAGES.storage ?? "" };
  } finally {
    releaseAiTurn();
  }
}

const saveInput = z.object({
  importId: z.uuid(),
  publish: z.boolean(),
  target: z.object({ id: z.uuid(), revision: z.number().int().positive() }).nullable(),
});

export async function saveParsedRecipe(input: z.input<typeof saveInput>): Promise<AiSaved> {
  await requireOwner();
  const parsedInput = saveInput.safeParse(input);
  if (!parsedInput.success) return { ok: false, message: "Не получилось сохранить — разберите рецепт ещё раз." };
  const { importId, publish, target } = parsedInput.data;
  try {
    const stored = await loadImport(importId);
    if (!stored) return { ok: false, message: "Разбор устарел — нажмите «Разобрать» ещё раз." };
    const { result, originalText } = stored;
    const sourceText = toCanonicalText(result.draft, result.mainIndex, catalogLabels(await getCatalog()));
    if (!isSavable(result) || byteLength(sourceText) > LIMITS.bytes) {
      return { ok: false, message: "Сначала решите пункты «Нужно решить» и разберите заново." };
    }
    const parsed = { draft: result.draft, mainIndex: result.mainIndex };
    const saved = target
      ? await replaceRecipe(target.id, target.revision, parsed, sourceText, originalText)
      : await createRecipe(parsed, sourceText, publish ? "published" : "draft", originalText);
    if (saved.ok) {
      refreshPublicSite();
      if (!target && publish) await translateLater(saved.id, false);
      await dropImport(importId); // разбор одноразовый: второе нажатие не создаст дубль
      return { ok: true, id: saved.id };
    }
    return {
      ok: false,
      message: saved.reason === "conflict" ? "Рецепт уже изменён в другой вкладке — обновите страницу." : "Рецепт не найден — возможно, его удалили.",
    };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("рецепт не сохранён", { pg: error.code });
    return { ok: false, message: "Не получилось сохранить — попробуйте ещё раз. Текст на месте." };
  }
}
