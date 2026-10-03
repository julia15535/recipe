import { describe, expect, it } from "vitest";

import { fraction } from "../fraction";
import type { AiRecipe } from "./ai-recipe";
import { toCanonicalText } from "./canonical";
import aiKotlety from "./fixtures/ai-kotlety.json";
import aiVafli from "./fixtures/ai-vafli.json";
import kotlety from "./fixtures/kotlety.txt?raw";
import vafliV2 from "./fixtures/vafli-v2.txt?raw";
import { fromAi, isSavable } from "./from-ai";
import { parseRecipeText } from "./parse";

const labels = {
  sections: new Map([["breakfast", "Завтраки"], ["hot", "Горячее"]]),
  tags: new Map([["protein", "Белок"]]),
};
const vafli = aiVafli as AiRecipe;
const kotletyAi = aiKotlety as AiRecipe;

describe("ответ ИИ → черновик и «Проверьте»", () => {
  it("вафли: всё на месте, сохранить можно; пересказ — в «изменено ИИ»", () => {
    const result = fromAi(vafli, vafliV2, labels);
    expect(result.ok).toBe(true);
    expect(result.draft.title).toBe("Творожные вафли");
    expect(result.mainIndex).toBe(0);
    expect(result.draft.ingredients[3]?.quantity).toEqual({ kind: "exact", amount: fraction(1, 2) });
    expect(result.draft.ingredients[4]).toMatchObject({ name: "Соль", quantity: { kind: "none" }, note: "щепотка" });
    expect(result.checks).toContainEqual({ group: "note", text: "Основной ингредиент — «Творог 0,5%»: от него пересчитывается рецепт." });
    expect(result.checks).toContainEqual({ group: "changed", text: "Раздел: Завтраки; особенности состава: Белок." });
  });

  it("котлеты: цитаты преобразований сверены с текстом; выход 12 шт.", () => {
    const result = fromAi(kotletyAi, kotlety, labels);
    expect(result.ok).toBe(true);
    expect(result.checks).toContainEqual({ group: "changed", text: "«полкило фарша» → Фарш — 500 г" });
    expect(result.draft.yield).toMatchObject({ amount: fraction(12), forms: ["штука", "штуки", "штук"] });
    const invented = fromAi({ ...kotletyAi, changes: [{ quote: "килограмм говядины", result: "1000 г" }] }, kotlety, labels);
    expect(invented.checks.find((check) => check.text.includes("килограмм говядины"))?.group).toBe("note");
  });

  it("нужно решить: не рецепт, нет основного, два основных, диапазон у основного, нет количества и пометки, 1/0", () => {
    expect(fromAi({ ...vafli, result_type: "not_recipe" }, vafliV2, labels).ok).toBe(false);
    // Основной не отмечен — не ошибка: рецепт без пересчёта (владелец 02.10).
    const noMain = fromAi({ ...vafli, ingredients: vafli.ingredients.map((item) => ({ ...item, is_main: false })) }, vafliV2, labels);
    expect(noMain.ok).toBe(true);
    expect(noMain.mainIndex).toBeNull();
    expect(isSavable(noMain)).toBe(true);
    expect(noMain.checks.find((check) => check.text.startsWith("Основной ингредиент не отмечен"))?.group).toBe("note");
    const twoMain = vafli.ingredients.map((item, index) => ({ ...item, is_main: index < 2 }));
    expect(fromAi({ ...vafli, ingredients: twoMain }, vafliV2, labels).ok).toBe(false);
    const rangeMain = vafli.ingredients.map((item, index) => (index === 0 ? { ...item, amount: "250–275" } : item));
    expect(fromAi({ ...vafli, ingredients: rangeMain }, vafliV2, labels).ok).toBe(false);
    const noAmount = vafli.ingredients.map((item, index) => (index === 1 ? { ...item, amount: null, note: null } : item));
    const result = fromAi({ ...vafli, ingredients: noAmount }, vafliV2, labels);
    expect(result.ok).toBe(true);
    expect(result.checks).toContainEqual({ group: "note", text: "У «Яйца» нет количества — на сайте будет без числа." });
    const zero = vafli.ingredients.map((item, index) => (index === 1 ? { ...item, amount: "1/0" } : item));
    expect(fromAi({ ...vafli, ingredients: zero }, vafliV2, labels).ok).toBe(false);
  });

  it("пределы: 61 ингредиент и 41 шаг обрезаются, длинные строки укорачиваются", () => {
    const many = { ...vafli, ingredients: Array.from({ length: 61 }, (_, index) => ({ ...vafli.ingredients[1]!, name: `И${index}`, is_main: index === 0 })) };
    expect(fromAi(many, vafliV2, labels).draft.ingredients).toHaveLength(60);
    const steps = fromAi({ ...vafli, steps: Array.from({ length: 41 }, () => "ш".repeat(3000)) }, vafliV2, labels).draft.steps;
    expect(steps).toHaveLength(40);
    expect(steps[0]).toHaveLength(2000);
  });

  it("слова автора не теряются: «ст. л. с горкой» → пометка; непонятный выход и длинное название — в «Проверьте»; NUL убран", () => {
    const ingredients = vafli.ingredients.map((item, index) => (index === 6 ? { ...item, unit: "ст. л. с горкой", note: null } : item));
    const result = fromAi({ ...vafli, ingredients, yield: { amount: "4–6", word: "шт." }, title: "Вафли\u0000" }, vafliV2, labels);
    expect(result.draft.ingredients[6]).toMatchObject({ unit: "ст. л.", note: "с горкой" });
    expect(result.checks.find((check) => check.text.startsWith("Выход «4–6"))?.group).toBe("note");
    expect(result.draft.title).toBe("Вафли");
    expect(fromAi({ ...vafli, title: "В".repeat(150) }, vafliV2, labels).checks).toContainEqual({
      group: "decide",
      text: "Название длиннее 120 знаков — сократите его.",
    });
  });

  it("ИИ отметил основной, а в тексте пометки нет — рецепт без пересчёта; есть пометка — основной остаётся", () => {
    const unmarked = fromAi(kotletyAi, kotlety, labels);
    expect(kotletyAi.ingredients[0]?.is_main).toBe(true);
    expect(unmarked.mainIndex).toBeNull();
    expect(unmarked.ok).toBe(true);
    expect(unmarked.checks.some((check) => check.text.startsWith("Основной ингредиент не отмечен"))).toBe(true);
    expect(unmarked.checks.some((check) => check.text.startsWith("Основной ингредиент — «"))).toBe(false);
    const marked = fromAi(kotletyAi, kotlety.replace("Подаём с пюре.", "Подаём с пюре. Основной — фарш."), labels);
    expect(marked.mainIndex).toBe(0);
  });

  it("перед сохранением разбор перепроверяется: подменённый `ok` не поможет", () => {
    const good = fromAi(vafli, vafliV2, labels);
    expect(isSavable(good)).toBe(true);
    expect(isSavable({ ...good, mainIndex: 1 })).toBe(true);
    expect(isSavable({ ...good, mainIndex: null })).toBe(true);
    expect(isSavable({ ...good, mainIndex: 4 })).toBe(false);
    expect(isSavable({ ...good, draft: { ...good.draft, steps: [] } })).toBe(false);
    expect(isSavable({ ...good, draft: { ...good.draft, tips: ["с".repeat(1001)] } })).toBe(false);
  });

  it("аккуратный текст: диапазон, пометка без числа, длинный шаг — снова разбирается без ошибок", () => {
    const ingredients = [
      { name: "Орехи", amount: "70–80", unit: "г", note: null, is_main: false },
      { name: "Мука", amount: "200", unit: "г", note: "просеять (дважды)", is_main: true },
      { name: "Соль", amount: null, unit: null, note: "по вкусу", is_main: false },
    ];
    const long = "Перемешать. ".repeat(160).trim();
    const { draft, mainIndex } = fromAi({ ...vafli, ingredients, steps: [long, "Испечь."] }, vafliV2, labels);
    const again = parseRecipeText(toCanonicalText(draft, mainIndex, labels));
    expect(again.issues.filter((item) => item.severity === "error")).toEqual([]);
    const bare = fromAi({ ...vafli, ingredients: [...ingredients, { name: "Зелень", amount: null, unit: null, note: null, is_main: false }] }, vafliV2, labels);
    expect(toCanonicalText(bare.draft, bare.mainIndex, labels)).toContain("\n- Зелень\n");
    expect(again.draft.ingredients.map((item) => item.quantity.kind)).toEqual(["range", "exact", "none"]);
    expect(again.draft.steps[0]).toBe(long);
  });

  it("аккуратный текст снова разбирается в тот же рецепт (вафли)", () => {
    const { draft, mainIndex } = fromAi(vafli, vafliV2, labels);
    const text = toCanonicalText(draft, mainIndex, labels);
    const again = parseRecipeText(text);
    expect(again.issues).toEqual([]);
    expect(again.mainIndex).toBe(mainIndex);
    expect(again.draft.ingredients.map(({ name, quantity, unit, note }) => ({ name, quantity, unit, note }))).toEqual(
      draft.ingredients.map(({ name, quantity, unit, note }) => ({ name, quantity, unit, note })),
    );
    expect(again.draft.steps).toEqual(draft.steps);
    expect(again.draft.sections).toEqual(["breakfast"]);
  });
});

describe("запись числа автора (ADR-0032)", () => {
  it("ИИ: «1/2» — дробь, «0,5» — десятичная, целое — без вида", () => {
    const rows = [
      { name: "Разрыхлитель", amount: "1/2", unit: "ч. л.", note: null, is_main: false },
      { name: "Масло", amount: "0,5", unit: "ст. л.", note: null, is_main: false },
      { name: "Мука", amount: "200", unit: "г", note: null, is_main: true },
    ];
    const { draft } = fromAi({ ...vafli, ingredients: rows }, vafliV2, labels);
    expect(draft.ingredients.map((item) => item.amountStyle)).toEqual(["fraction", "decimal", undefined]);
  });

  it("«Изменить» → «Разобрать» сохраняет запись каждой строки", () => {
    const text = "Тест\nТеги: завтрак\nИнгредиенты:\n- Мука — 200 г - основной\n- Разрыхлитель — 1/2 ч. л.\n- Масло — 0,5 ст. л.\n- Сахар — 1 1/2 ст. л.\nПриготовление:\n1. Смешать.";
    const first = parseRecipeText(text);
    const canonical = toCanonicalText(first.draft, first.mainIndex, labels);
    expect(canonical).toContain("- Разрыхлитель — 1/2 ч. л.");
    expect(canonical).toContain("- Масло — 0,5 ст. л.");
    expect(canonical).toContain("- Сахар — 1 1/2 ст. л.");
    const again = parseRecipeText(canonical);
    expect(again.draft.ingredients.map((item) => item.amountStyle)).toEqual([undefined, "fraction", "decimal", "fraction"]);
  });
});
