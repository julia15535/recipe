import { describe, expect, it } from "vitest";

import { fraction, parseDecimal } from "./fraction";
import type { Quantity } from "./quantity";
import { kindOf, showQuantity } from "./rounding";

const f = (value: number) => parseDecimal(String(value)) ?? fraction(Math.round(value * 1e6), 1e6);
const exact = (value: number): Quantity => ({ kind: "exact", amount: f(value) });
const line = (name: string, value: number, unit: string | null, note: string | null = null) => ({ name, quantity: exact(value), unit, note });
// Вафли: творог 275 → 300 г.
const WAFFLES = fraction(300, 275);
// Как показывает интерфейс по-русски (коды → слова из messages/ru.json).
const words = (result: ReturnType<typeof showQuantity>) => {
  if (!result) return result;
  const amount = result.special === "pinch" ? "щепотка" : result.special === "upTo" ? `до ${result.amount}` : result.amount;
  const hint = result.hint === "weighEggs" ? " (слегка перемешайте яйца и отвесьте)" : "";
  return `${result.approx ? "≈ " : ""}${amount} ${result.special === "pinch" ? "" : (result.unit ?? "")}`.trim() + hint;
};
const shown = (name: string, value: number, unit: string | null, factor = WAFFLES, note: string | null = null) =>
  words(showQuantity(line(name, value, unit, note), factor));

describe("округление пересчёта — вафли на 300 г творога", () => {
  it("как в плане: яйца, мука, разрыхлитель, масло, молоко", () => {
    expect(shown("Яйца", 2, "шт.")).toBe("≈ 2 шт.");
    expect(shown("Цельнозерновая мука", 50, "г")).toBe("≈ 55 г");
    expect(shown("Разрыхлитель", 0.5, "ч. л.")).toBe("≈ ½ ч. л.");
    expect(shown("Растительное масло", 0.5, "ст. л.")).toBe("≈ ½ ст. л.");
    expect(shown("Молоко", 1, "ст. л.")).toBe("≈ 1 ст. л.");
  });

  it("коэффициент 1 — как в рецепте, без ≈ и без округления", () => {
    expect(shown("Яйца", 2, "шт.", fraction(1))).toBe("2 шт.");
    expect(shown("Сода", 0.75, "ч. л.", fraction(1))).toBe("¾ ч. л.");
    expect(shown("Мука", 54.5, "г", fraction(1))).toBe("54,5 г");
  });

  it("без количества — null (показывается пометка)", () => {
    expect(showQuantity({ name: "Соль", quantity: { kind: "none" }, unit: null, note: "щепотка" }, WAFFLES)).toBeNull();
  });
});

describe("округление — правила", () => {
  const x = (k: number) => f(k);

  it("граммы и мл: до 1, не 0; от 1000 — кг/л до сотых; кг меньше 1 — в граммы", () => {
    expect(shown("Мука", 100, "г", x(0.004))).toBe("≈ 1 г");
    expect(shown("Мука", 999.4, "г", x(1))).toBe("999,4 г");
    expect(shown("Мука", 999.4, "г", x(1.000001))).toBe("≈ 999 г");
    expect(shown("Мука", 999.6, "г", x(1.000001))).toBe("≈ 1 кг");
    expect(shown("Мука", 625, "г", x(2))).toBe("≈ 1,25 кг");
    expect(shown("Вода", 2, "л", x(0.44))).toBe("≈ 880 мл");
    expect(shown("Мясо", 1.5, "кг", x(2))).toBe("≈ 3 кг");
  });

  it("ложки: к ближайшей ¼; маленькая ст. л. — в ч. л.; меньше ⅛ ч. л. — щепотка", () => {
    expect(shown("Сахар", 2, "ч. л.", x(1.09))).toBe("≈ 2¼ ч. л.");
    expect(shown("Масло", 1, "ст. л.", x(1.6))).toBe("≈ 1½ ст. л.");
    expect(shown("Соус", 1, "ст. л.", x(0.1))).toBe("≈ ¼ ч. л.");
    expect(shown("Соус", 1, "ст. л.", x(0.3))).toBe("≈ 1 ч. л.");
    expect(shown("Соус", 1, "ст. л.", x(2.18))).toBe("≈ 2 ст. л.");
    expect(shown("Соус", 1, "ст. л.", x(1.25))).toBe("≈ 3¾ ч. л.");
    expect(shown("Корица", 0.5, "ч. л.", x(0.26))).toBe("≈ ¼ ч. л.");
    expect(shown("Корица", 0.5, "ч. л.", x(0.24))).toBe("≈ щепотка");
  });

  it("стаканы: к ¼; меньше ⅛ стакана — в ложки", () => {
    expect(shown("Молоко", 1, "стакан", x(0.76))).toBe("≈ ¾ стакан");
    expect(shown("Молоко", 1, "стак.", x(0.1))).toBe("≈ 1½ ст. л.");
  });

  it("яйца: целые при отклонении ≤ 15 %, иначе граммами с подсказкой", () => {
    expect(shown("Яйца", 1, "шт.", x(0.99))).toBe("≈ 1 шт.");
    expect(shown("Яйцо", 1, "шт.", x(1.01))).toBe("≈ 1 шт.");
    expect(shown("Яйца", 1, "шт.", x(1.49))).toBe("≈ 75 г (слегка перемешайте яйца и отвесьте)");
    expect(shown("Яйца", 1, "шт.", x(1.5))).toBe("≈ 75 г (слегка перемешайте яйца и отвесьте)");
    expect(shown("Яйца", 1, "шт.", x(1.51))).toBe("≈ 75 г (слегка перемешайте яйца и отвесьте)");
    expect(shown("Яйца", 2, null, x(1.09))).toBe("≈ 2 шт.");
    expect(shown("Яйцо", 1, "шт.", x(0.3))).toBe("≈ 15 г (слегка перемешайте яйца и отвесьте)");
    expect(shown("Яйцо", 1, "шт.", x(0.01))).toBe("≈ 5 г (слегка перемешайте яйца и отвесьте)");
  });

  it("не яйца: желток, белок, яичный порошок, перепелиные — штучное; «для смазки» — без пересчёта", () => {
    expect(kindOf({ name: "Желток", unit: "шт.", note: null })).toBe("piece");
    expect(kindOf({ name: "Яичный белок", unit: "шт.", note: null })).toBe("piece");
    expect(kindOf({ name: "Яичный порошок", unit: "г", note: null })).toBe("weight");
    expect(kindOf({ name: "Яйца перепелиные", unit: "шт.", note: null })).toBe("piece");
    expect(shown("Яйцо", 1, "шт.", x(2), "для смазки")).toBe("1 шт.");
    expect(shown("Желток", 1, "шт.", x(1.5))).toBe("≈ 1½ шт.");
  });

  it("штучное: до ½ при отклонении ≤ 25 %, иначе до десятых; никогда не 0", () => {
    expect(shown("Лук", 1, "шт.", x(1.3))).toBe("≈ 1½ шт.");
    expect(shown("Лук", 1, "шт.", x(0.1))).toBe("≈ 0,1 шт.");
    expect(shown("Чеснок", 4, "зуб.", x(0.44))).toBe("≈ 2 зуб.");
    expect(shown("Лук", 1, "шт.", x(0.01))).toBe("≈ 0,1 шт.");
  });

  it("диапазоны: оба конца; разные единицы — оба в мелкой", () => {
    const range = (min: number, max: number): Quantity => ({ kind: "range", min: f(min), max: f(max) });
    const r = (name: string, min: number, max: number, unit: string, k: number) => words(showQuantity({ name, quantity: range(min, max), unit, note: null }, x(k)));
    expect(r("Разрыхлитель", 0.5, 1, "ч. л.", 2)).toBe("≈ 1–2 ч. л.");
    expect(r("Орехи", 70, 80, "г", 1.09)).toBe("≈ 76–87 г");
    expect(r("Мука", 495, 505, "г", 2)).toBe("≈ 990–1010 г");
    expect(r("Яйца", 1, 2, "шт.", 0.45)).toBe("≈ 25–45 г (слегка перемешайте яйца и отвесьте)");
    expect(r("Корица", 0.1, 0.5, "ч. л.", 1.01)).toBe("≈ до ½ ч. л.");
  });
});

describe("округление по-английски и стакан 250 мл", () => {
  it("числа с точкой, коды вместо слов; вид строки из перевода", () => {
    const en = (value: number, unit: string, k: number, kind?: Parameters<typeof showQuantity>[2] extends infer O ? O extends { kind?: infer K } ? K : never : never) =>
      showQuantity({ name: "Egg", quantity: exact(value), unit, note: null }, f(k), { lang: "en", kind });
    expect(en(625, "г", 2)).toMatchObject({ amount: "1.25", unit: "кг", approx: true });
    expect(en(1, "шт.", 0.1)).toMatchObject({ amount: "0.1" });
    // Английское «Egg» по словам не распознать — вид «egg» приходит из перевода.
    expect(en(2, "шт.", 1.25, "egg")).toMatchObject({ amount: "125", unit: "г", hint: "weighEggs" });
    expect(en(0.5, "ч. л.", 0.2)).toMatchObject({ special: "pinch" });
  });

  it("очень малая доля стакана — в ложки по 250 мл", () => {
    // 1/10 стакана = 25 мл ≈ 1⅔ ст. л. → ближайшая половинка 1½ (отклонение 10 %).
    expect(shown("Молоко", 1, "стак.", f(0.1))).toBe("≈ 1½ ст. л.");
  });
});
