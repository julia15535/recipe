import { describe, expect, it } from "vitest";

import { NO_LIST, repeatNotes } from "./ai-checks";
import type { AiRecipe } from "./ai-recipe";
import aiKotlety from "./fixtures/ai-kotlety.json";
import aiVafli from "./fixtures/ai-vafli.json";
import kotlety from "./fixtures/kotlety.txt?raw";
import vafliV2 from "./fixtures/vafli-v2.txt?raw";
import { fromAi, isSavable } from "./from-ai";
import type { ParsedIngredient } from "./parse";

const labels = { sections: new Map<string, string>(), tags: new Map<string, string>() };
const row = (name: string, note: string | null = null): ParsedIngredient => ({
  name,
  quantity: { kind: "none" },
  unit: null,
  note,
  main: false,
  line: 1,
  raw: name,
});
const repeats = (...rows: ParsedIngredient[]) => repeatNotes(rows).map((check) => check.text);

describe("замечания к ИИ-разбору от нашего кода", () => {
  it("списка не было (абзац) — замечание; был список или «не рецепт» — нет", () => {
    expect(fromAi(aiKotlety as AiRecipe, kotlety, labels).checks).toContainEqual({ group: "note", text: NO_LIST });
    expect(fromAi(aiVafli as AiRecipe, vafliV2, labels).checks.map((check) => check.text)).not.toContain(NO_LIST);
    const notRecipe = { ...(aiKotlety as AiRecipe), result_type: "not_recipe" as const };
    expect(fromAi(notRecipe, kotlety, labels).checks.map((check) => check.text)).not.toContain(NO_LIST);
  });

  it("повтор названия — замечание (регистр, «ё», условие в пометке или скобках), сохранить не мешает", () => {
    const flour = { name: "Кокосовая мука", amount: "1", unit: "ч. л.", note: "если масса мягкая", is_main: false };
    const result = fromAi({ ...(aiVafli as AiRecipe), ingredients: [...(aiVafli as AiRecipe).ingredients, flour, { ...flour, amount: "10", unit: "г", note: null }] }, vafliV2, labels);
    expect(result.checks).toContainEqual({ group: "note", text: "«Кокосовая мука» есть в списке 2 раза — проверьте, нужны ли обе строки." });
    expect(isSavable(result)).toBe(true);
    expect(repeats(row("Тёртый сыр"), row("тертый  сыр"))).toHaveLength(1);
    expect(repeats(row("Яйцо"), row("Яйца"))).toEqual(["«Яйцо» есть в списке 2 раза — проверьте, нужны ли обе строки."]);
    expect(repeats(row("Мука"), row("Мука (если тесто липкое)"), row("мука", "по желанию"))).toEqual([
      "«Мука» есть в списке 3 раза — проверьте, нужны ли все строки.",
    ]);
  });

  it("законные повторы и разные продукты — без замечания", () => {
    expect(repeats(row("Сахар (в тесто)"), row("Сахар (в крем)"))).toEqual([]);
    expect(repeats(row("Сахар в тесто"), row("Сахар в крем"))).toEqual([]);
    expect(repeats(row("Масло", "для жарки"), row("Масло", "в тесто"))).toEqual([]);
    expect(repeats(row("Мука пшеничная"), row("Мука рисовая"))).toEqual([]);
    expect(repeats(row("Яйцо"), row("Яичный желток"))).toEqual([]);
  });
});
