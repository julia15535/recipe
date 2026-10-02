import { describe, expect, it } from "vitest";

import { fraction } from "../fraction";
import { parseIngredientLine } from "./ingredient-line";

const exact = (num: number, den = 1) => ({ kind: "exact", amount: fraction(num, den) });

describe("строка ингредиента в стиле владельца", () => {
  it.each([
    ["● Творог 0,5% — 275 г - основной ингредиент", { name: "Творог 0,5%", quantity: exact(275), unit: "г", note: null, main: true }],
    ["● Яйца — 2 шт.", { name: "Яйца", quantity: exact(2), unit: "шт.", note: null, main: false }],
    ["● Разрыхлитель — ½–1 ч. л.", { name: "Разрыхлитель", quantity: { kind: "range", min: fraction(1, 2), max: fraction(1) }, unit: "ч. л.", note: null, main: false }],
    ["● Соль — щепотка", { name: "Соль", quantity: { kind: "none" }, unit: null, note: "щепотка", main: false }],
    ["● Чёрный перец / итальянские травы / паприка — (по желанию)", { name: "Чёрный перец / итальянские травы / паприка", quantity: { kind: "none" }, unit: null, note: "по желанию", main: false }],
    ["● растительное масло - ½ ст. л.", { name: "Растительное масло", quantity: exact(1, 2), unit: "ст. л.", note: null, main: false }],
    ["● молоко 1ст л (если творог сухой)", { name: "Молоко", quantity: exact(1), unit: "ст. л.", note: "если творог сухой", main: false }],
    ["Мука 200г", { name: "Мука", quantity: exact(200), unit: "г", note: null, main: false }],
    ["Лук-порей — 1 шт.", { name: "Лук-порей", quantity: exact(1), unit: "шт.", note: null, main: false }],
    ["Сахар — ⅓ стакана", { name: "Сахар", quantity: exact(1, 3), unit: "стак.", note: null, main: false }],
    ["Курица — 800 г (основной)", { name: "Курица", quantity: exact(800), unit: "г", note: null, main: true }],
    ["- Мёд: 1 ст. л. с горкой", { name: "Мёд", quantity: exact(1), unit: "ст. л.", note: "с горкой", main: false }],
    ["Яйца — 2, крупные", { name: "Яйца", quantity: exact(2), unit: null, note: "крупные", main: false }],
    ["Мука — 1 1/2 стакана", { name: "Мука", quantity: exact(3, 2), unit: "стак.", note: null, main: false }],
    ["Зелень (по вкусу)", { name: "Зелень", quantity: { kind: "none" }, unit: null, note: "по вкусу", main: false }],
  ])("%s", (line, expected) => {
    const result = parseIngredientLine(line);
    expect(result.ok && result.value).toEqual(expected);
  });

  it("неизвестная единица остаётся как написана — с предупреждением", () => {
    const result = parseIngredientLine("Чеснок — 2 зубца");
    expect(result.ok && result.value.unit).toBe("зуб.");
    const odd = parseIngredientLine("Лавровый лист — 2 листика");
    expect(odd.ok && odd.unknownUnit).toBe("листика");
  });

  it("без количества — строка без числа; непонятное количество — ошибка; диапазон наоборот — ошибка", () => {
    // Без количества — можно: строка без числа (владелец 02.10).
    expect(parseIngredientLine("Соль")).toMatchObject({ ok: true, value: { name: "Соль", quantity: { kind: "none" }, note: null } });
    expect(parseIngredientLine("Соль — немного").ok).toBe(false);
    expect(parseIngredientLine("Мука — 2–1 ст. л.").ok).toBe(false);
    expect(parseIngredientLine("Мука — 0 г").ok).toBe(false);
    expect(parseIngredientLine("Морковь (крупная)")).toMatchObject({ ok: true, value: { name: "Морковь", note: "крупная" } });
  });
});
