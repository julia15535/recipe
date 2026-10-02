import "server-only";

import { type AiDraft, fromAi, type Labels } from "@/lib/domain/recipe-text/from-ai";
import { LIMITS, byteLength } from "@/lib/domain/recipe-text/limits";
import type { AiConfig } from "@/lib/server/env";

import { type AiFailure, chatJson } from "./gateway";
import { RECIPE_JSON_SCHEMA } from "./recipe-schema";
import { aiRecipeSchema } from "./recipe-schema";
import { RECIPE_PROMPT, RECIPE_PROMPT_VERSION } from "./recipe-prompt";

export type AiParse = { ok: true; result: AiDraft } | { ok: false; reason: AiFailure | "too-large" | "empty" };

/** Свободный текст рецепта → проверенный черновик через ИИ. Ответ, не прошедший zod, — «bad-response». */
export async function parseWithAi(text: string, config: AiConfig, labels: Labels): Promise<AiParse> {
  if (text.trim() === "") return { ok: false, reason: "empty" };
  if (byteLength(text) > LIMITS.bytes) return { ok: false, reason: "too-large" };
  const answer = await chatJson(config, {
    system: RECIPE_PROMPT,
    user: text,
    schemaName: "recipe",
    schema: RECIPE_JSON_SCHEMA,
    maxTokens: 8000,
    // Меньше 60 с таймаута прокси: иначе владелец увидит «нет связи», а разбор всё равно оплачен.
    timeoutMs: 45_000,
    label: `recipe ${RECIPE_PROMPT_VERSION}`,
  });
  if (!answer.ok) return answer;
  const parsed = aiRecipeSchema.safeParse(answer.json);
  if (!parsed.success) return { ok: false, reason: "bad-response" };
  return { ok: true, result: fromAi(parsed.data, text, labels) };
}
