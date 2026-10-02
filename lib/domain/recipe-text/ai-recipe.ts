// Ответ ИИ-разбора (план recipe-ai-parse) — форма, которую задаёт JSON-схема `lib/server/ai/recipe-schema.ts`.
// Доверия к содержимому нет: всё проверяет `fromAi` (from-ai.ts).
import type { SectionCode, TagCode } from "../catalog";

export type AiIngredient = { name: string; amount: string | null; unit: string | null; note: string | null; is_main: boolean };

export type AiRecipe = {
  result_type: "recipe" | "not_recipe";
  title: string;
  description: string | null;
  time: string | null;
  yield: { amount: string; word: string } | null;
  sections: SectionCode[];
  tags: TagCode[];
  ingredients: AiIngredient[];
  steps: string[];
  tips: string[];
  /** Каждое преобразование: дословная цитата из текста и что получилось («полкило фарша» → «500 г»). */
  changes: { quote: string; result: string }[];
  doubts: string[];
};

/** Пункт «Проверьте»: изменено ИИ / нужно решить (сохранить нельзя) / замечание. */
export type Check = { group: "changed" | "decide" | "note"; text: string };
