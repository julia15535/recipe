import "server-only";

import { composeTranslation, type SourceRecipe, type TranslationBody, type TranslationHead } from "@/lib/domain/translation";
import { type Masked, maskNumbers } from "@/lib/domain/translation-numbers";
import type { AiConfig } from "@/lib/server/env";

import { type AiFailure, chatJson } from "./gateway";
import { TRANSLATE_PROMPT, TRANSLATE_PROMPT_VERSION } from "./translate-prompt";
import { aiTranslationSchema, TRANSLATION_JSON_SCHEMA } from "./translate-schema";

// Перевод рецепта на британский английский через тот же шлюз ИИ (ADR-0024, ADR-0029). На вход ИИ — только тексты,
// числа в них — метками; ответ проверяется по форме (zod), порядку строк и меткам (`composeTranslation`).
export type Translated = { ok: true; head: TranslationHead; body: TranslationBody; model: string; promptVersion: string };
export type TranslateFailure = AiFailure | "structure" | "numbers";

export async function translateWithAi(source: SourceRecipe, config: AiConfig): Promise<Translated | { ok: false; reason: TranslateFailure }> {
  const masks = new Map<string, Masked>();
  const mask = (path: string, text: string | null) => {
    if (text === null) return null;
    const masked = maskNumbers(text);
    masks.set(path, masked);
    return masked.text;
  };
  const input = {
    title: mask("title", source.title),
    description: mask("description", source.description),
    time: mask("time", source.time),
    yield: source.yield && { word: source.yield.forms[0] },
    ingredients: source.ingredients.map((row) => ({
      id: row.id,
      name: mask(`ingredients.${row.id}.name`, row.name),
      note: mask(`ingredients.${row.id}.note`, row.note),
      unit: row.unit,
    })),
    steps: source.steps.map((row) => ({ id: row.id, text: mask(`steps.${row.id}`, row.text) })),
    tips: source.tips.map((row) => ({ id: row.id, text: mask(`tips.${row.id}`, row.text) })),
  };
  const answer = await chatJson(config, {
    system: TRANSLATE_PROMPT,
    user: JSON.stringify(input),
    schemaName: "recipe_translation",
    schema: TRANSLATION_JSON_SCHEMA,
    maxTokens: 8000,
    timeoutMs: 45_000,
    label: `translate ${TRANSLATE_PROMPT_VERSION}`,
  });
  if (!answer.ok) return answer;
  const parsed = aiTranslationSchema.safeParse(answer.json);
  if (!parsed.success) return { ok: false, reason: "bad-response" };
  const composed = composeTranslation(source, parsed.data, masks);
  if (!composed.ok) return composed;
  return { ok: true, head: composed.head, body: composed.body, model: config.model, promptVersion: TRANSLATE_PROMPT_VERSION };
}
