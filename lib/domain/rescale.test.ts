import { describe, expect, it } from "vitest";

import { fraction } from "./fraction";
import { MAX_FACTOR, formatAmount, formatInput, formatQuantity, parseAmount, yieldLabel } from "./rescale";

const f = fraction;

describe("пересчёт от основного ингредиента", () => {
  it("принимает целое, запятую (RU) и точку (EN)", () => {
    expect(parseAmount("250", f(500))).toEqual({ ok: true, value: f(250) });
    expect(parseAmount(" 2,5 ", f(3))).toEqual({ ok: true, value: f(5, 2) });
    expect(parseAmount("2.5", f(3))).toEqual({ ok: true, value: f(5, 2) });
  });

  it("отвергает пусто, не число, ноль и слишком много", () => {
    expect(parseAmount("", f(500))).toEqual({ ok: false, reason: "empty" });
    expect(parseAmount("-5", f(500))).toEqual({ ok: false, reason: "format" });
    expect(parseAmount("1,2,3", f(500))).toEqual({ ok: false, reason: "format" });
    expect(parseAmount("0", f(500))).toEqual({ ok: false, reason: "zero" });
    expect(parseAmount(String(500 * MAX_FACTOR + 1), f(500))).toEqual({ ok: false, reason: "tooBig" });
  });

  it("выход — порции по-русски и дробные; у изделий свои формы слова", () => {
    expect(yieldLabel(f(1))).toBe("1 порция");
    expect(yieldLabel(f(5, 2))).toBe("2,5 порции");
    expect(yieldLabel(f(176, 100))).toBe("1,8 порции");
    const waffles = ["вафля", "вафли", "вафель"] as const;
    expect(yieldLabel(f(4), waffles)).toBe("4 вафли");
    expect(yieldLabel(f(8), waffles)).toBe("8 вафель");
    expect(yieldLabel(f(21), waffles)).toBe("21 вафля");
  });

  it("десятичной записью (владелец 03.10): половины и четверти — точно, трети — до десятых", () => {
    expect(formatAmount(f(1, 2))).toBe("0,5");
    expect(formatAmount(f(3, 2))).toBe("1,5");
    expect(formatAmount(f(5, 4))).toBe("1,25");
    expect(formatAmount(f(7, 4))).toBe("1,75");
    expect(formatAmount(f(1, 4))).toBe("0,25");
    expect(formatAmount(f(3, 4))).toBe("0,75");
    expect(formatAmount(f(1, 3))).toBe("0,3");
    expect(formatAmount(f(2, 3))).toBe("0,7");
    expect(formatAmount(f(4, 3))).toBe("1,3");
    expect(formatAmount(f(2))).toBe("2");
    expect(formatAmount(f(249, 1000))).toBe("0,25");
    expect(formatAmount(f(275, 2))).toBe("137,5");
    expect(formatAmount(f(1500)).replace(/\s/g, " ")).toBe("1 500");
    expect(formatAmount(f(1500), "en")).toBe("1,500");
    expect(formatAmount(f(5, 4), "en")).toBe("1.25");
    expect(formatAmount(f(1, 8))).toBe("0,13");
    expect(formatAmount(f(2, 1000))).toBe("0,002");
    expect(formatAmount(f(264, 10))).toBe("26,4");
  });

  it("треть × 2 — точно ⅔ (0,7); диапазон — с обеих сторон", () => {
    expect(formatQuantity({ kind: "exact", amount: f(1, 3) }, f(2))).toBe("0,7");
    expect(formatQuantity({ kind: "range", min: f(1, 2), max: f(1) }, f(1))).toBe("0,5–1");
    expect(formatQuantity({ kind: "range", min: f(1, 2), max: f(1) }, f(2))).toBe("1–2");
    expect(formatQuantity({ kind: "range", min: f(1, 2), max: f(1) }, f(1, 2))).toBe("0,25–0,5");
    expect(formatQuantity({ kind: "range", min: f(1), max: f(1) }, f(1))).toBe("1");
    expect(formatQuantity({ kind: "range", min: f(1, 2), max: f(1) }, f(727, 1000))).toBe("0,36–0,73");
    expect(formatQuantity({ kind: "range", min: f(1, 3), max: f(2, 3) }, f(1), "en")).toBe("0.3–0.7");
    expect(formatQuantity({ kind: "none" }, f(2))).toBeNull();
  });

  it("значение поля ввода — без пробела между тысячами и снова читается", () => {
    expect(formatInput(f(1500))).toBe("1500");
    expect(formatInput(f(3, 2))).toBe("1,5");
    expect(parseAmount(formatInput(f(1500)), f(1500))).toEqual({ ok: true, value: f(1500) });
  });
});
