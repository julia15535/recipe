import { describe, expect, it } from "vitest";

import type { AiRecipe } from "@/lib/domain/recipe-text/ai-recipe";
import aiVafli from "@/lib/domain/recipe-text/fixtures/ai-vafli.json";
import vafliV2 from "@/lib/domain/recipe-text/fixtures/vafli-v2.txt?raw";
import { fromAi } from "@/lib/domain/recipe-text/from-ai";

import { RECIPE_JSON_SCHEMA } from "./recipe-schema";

const pattern = new RegExp(RECIPE_JSON_SCHEMA.properties.ingredients.items.properties.amount.pattern);
const labels = { sections: new Map<string, string>(), tags: new Map<string, string>() };
const parsed = (amount: string) => {
  const ai = { ...(aiVafli as AiRecipe), ingredients: [{ name: "Мука", amount, unit: "ч. л.", note: null, is_main: false }] };
  return fromAi(ai, vafliV2, labels);
};

describe("схема ответа ИИ и наш разбор количества — заодно", () => {
  it("записи из промпта: схема пропускает, разбор понимает и запоминает вид записи автора", () => {
    const cases: [string, "fraction" | "decimal" | undefined][] = [
      ["275", undefined],
      ["0,5", "decimal"],
      ["1.5", "decimal"],
      ["1/2", "fraction"],
      ["1 1/2", "fraction"],
      ["70–80", undefined],
      ["1/2–1", "fraction"],
      ["1–1 1/2", "fraction"],
      ["0,25 - 0,5", "decimal"],
    ];
    for (const [amount, style] of cases) {
      expect(pattern.test(amount), amount).toBe(true);
      const result = parsed(amount);
      expect(result.checks.filter((check) => check.group === "decide"), amount).toEqual([]);
      expect(result.draft.ingredients[0]?.amountStyle, amount).toBe(style);
    }
  });

  it("чужое схема не пропускает", () => {
    for (const amount of ["½", "1,2,3", "пол", "1/2/3", ""]) expect(pattern.test(amount), amount).toBe(false);
  });
});
