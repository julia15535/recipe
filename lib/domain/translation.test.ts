import { describe, expect, it } from "vitest";

import { fraction } from "./fraction";
import { type AiTranslation, composeTranslation, type SourceRecipe } from "./translation";
import { type Masked, maskNumbers, unmaskNumbers } from "./translation-numbers";

const source: SourceRecipe = {
  schemaVersion: 1,
  title: "Творожные вафли",
  description: null,
  time: "25 мин",
  yield: { amount: fraction(4), forms: ["вафля", "вафли", "вафель"] },
  sectionCodes: ["breakfast"],
  primarySectionCode: "breakfast",
  tagCodes: ["protein"],
  mainId: "i1",
  ingredients: [
    { id: "i1", name: "Творог 0,5%", note: null, quantity: { kind: "exact", amount: fraction(275) }, unit: "г", kind: "weight" },
    { id: "i2", name: "Соль", note: "щепотка", quantity: { kind: "none" }, unit: null, kind: "piece" },
  ],
  steps: [{ id: "s1", text: "Выпекайте 6–7 минут при 180 °C." }],
  tips: [],
};

function masksOf(recipe: SourceRecipe) {
  const masks = new Map<string, Masked>();
  const add = (path: string, text: string | null) => text !== null && masks.set(path, maskNumbers(text));
  add("title", recipe.title);
  add("time", recipe.time);
  for (const row of recipe.ingredients) {
    add(`ingredients.${row.id}.name`, row.name);
    add(`ingredients.${row.id}.note`, row.note);
  }
  for (const row of recipe.steps) add(`steps.${row.id}`, row.text);
  return masks;
}

const answer: AiTranslation = {
  title: "Cottage cheese waffles",
  description: null,
  time: "⟦1⟧ min",
  yieldForms: ["waffle", "waffles"],
  ingredients: [
    { id: "i1", name: "Cottage cheese ⟦1⟧%", note: null, unitForms: null },
    { id: "i2", name: "Salt", note: "a pinch", unitForms: null },
  ],
  steps: [{ id: "s1", text: "Bake for ⟦1⟧–⟦2⟧ minutes at ⟦3⟧ °C." }],
  tips: [],
};

describe("перевод: числа под метками", () => {
  it("маска и обратно; на английском запятая → точка", () => {
    const { text, numbers } = maskNumbers("Творог 0,5% — 275 г, ½ ч. л., 6–7 мин");
    expect(text).toBe("Творог ⟦1⟧% — ⟦2⟧ г, ⟦3⟧ ч. л., ⟦4⟧–⟦5⟧ мин");
    expect(unmaskNumbers("Cottage cheese ⟦1⟧% — ⟦2⟧ g, ⟦3⟧ tsp, ⟦4⟧–⟦5⟧ min", numbers, "en")).toBe("Cottage cheese 0.5% — 275 g, ½ tsp, 6–7 min");
  });

  it("потерянная, лишняя или повторённая метка, свои числа, Фаренгейт, потерянные ° и % — отказ", () => {
    expect(unmaskNumbers("at °C", ["180"], "en")).toBeNull();
    expect(unmaskNumbers("⟦1⟧ and ⟦2⟧", ["180"], "en")).toBeNull();
    expect(unmaskNumbers("⟦1⟧ ⟦1⟧", ["1", "2"], "en")).toBeNull();
    expect(unmaskNumbers("Bake at ⟦1⟧ °C (350 °F)", ["180"], "en", "при ⟦1⟧ °C")).toBeNull();
    expect(unmaskNumbers("Bake at ⟦1⟧ °F", ["180"], "en", "при ⟦1⟧ °C")).toBeNull();
    expect(unmaskNumbers("Bake at ⟦1⟧ degrees", ["180"], "en", "при ⟦1⟧ °C")).toBeNull();
    expect(unmaskNumbers("Cheese ⟦1⟧", ["5"], "en", "Творог ⟦1⟧%")).toBeNull();
    expect(unmaskNumbers("Bake at ⟦1⟧ °C", ["180"], "en", "при ⟦1⟧ °C")).toBe("Bake at 180 °C");
  });

  it("сборка: тексты от ИИ, количества и коды — из русского снимка", () => {
    const result = composeTranslation(source, answer, masksOf(source));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.head).toEqual({ title: "Cottage cheese waffles", description: null, time: "25 min", yieldForms: ["waffle", "waffles"] });
    expect(result.body.ingredients[0]).toMatchObject({ name: "Cottage cheese 0.5%", quantity: { kind: "exact", amount: fraction(275) }, unit: "г", kind: "weight" });
    expect(result.body.steps[0]?.text).toBe("Bake for 6–7 minutes at 180 °C.");
    expect(result.body).toMatchObject({ sectionCodes: ["breakfast"], tagCodes: ["protein"], mainId: "i1", yield: fraction(4) });
  });

  it("авторская единица без английских форм, пустые формы выхода, длинное название — отказ", () => {
    const withCustom: SourceRecipe = { ...source, ingredients: [{ ...source.ingredients[0]!, unit: "горсть" }, source.ingredients[1]!] };
    expect(composeTranslation(withCustom, answer, masksOf(withCustom))).toEqual({ ok: false, reason: "structure" });
    const handful = { ...answer, ingredients: [{ ...answer.ingredients[0]!, unitForms: ["handful", "handfuls"] as [string, string] }, answer.ingredients[1]!] };
    expect(composeTranslation(withCustom, handful, masksOf(withCustom)).ok).toBe(true);
    expect(composeTranslation(source, { ...answer, yieldForms: ["", ""] }, masksOf(source))).toEqual({ ok: false, reason: "structure" });
    expect(composeTranslation(source, { ...answer, title: "x".repeat(121) }, masksOf(source))).toEqual({ ok: false, reason: "structure" });
    expect(composeTranslation(source, { ...answer, time: null }, masksOf(source))).toEqual({ ok: false, reason: "structure" });
  });

  it("ИИ поменял число, порядок строк или добавил описание — отказ", () => {
    const masks = masksOf(source);
    expect(composeTranslation(source, { ...answer, steps: [{ id: "s1", text: "Bake for 10 minutes." }] }, masks)).toEqual({ ok: false, reason: "numbers" });
    expect(composeTranslation(source, { ...answer, ingredients: [...answer.ingredients].reverse() }, masks)).toEqual({ ok: false, reason: "structure" });
    expect(composeTranslation(source, { ...answer, description: "Lovely." }, masks)).toEqual({ ok: false, reason: "structure" });
  });
});
