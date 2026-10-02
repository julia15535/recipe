import { describe, expect, it } from "vitest";

import { MAX_FACTOR, formatAmount, formatInput, formatQuantity, parseAmount, yieldLabel } from "./demo-rescale";

describe("демо-пересчёт прототипа", () => {
  it("принимает целое, запятую (RU) и точку (EN)", () => {
    expect(parseAmount("250", 500)).toEqual({ ok: true, value: 250 });
    expect(parseAmount(" 2,5 ", 3)).toEqual({ ok: true, value: 2.5 });
    expect(parseAmount("2.5", 3)).toEqual({ ok: true, value: 2.5 });
  });

  it("отвергает пусто, не число, ноль и слишком много", () => {
    expect(parseAmount("", 500)).toEqual({ ok: false, reason: "empty" });
    expect(parseAmount("-5", 500)).toEqual({ ok: false, reason: "format" });
    expect(parseAmount("1,2,3", 500)).toEqual({ ok: false, reason: "format" });
    expect(parseAmount("0", 500)).toEqual({ ok: false, reason: "zero" });
    expect(parseAmount(String(500 * MAX_FACTOR + 1), 500)).toEqual({ ok: false, reason: "tooBig" });
  });

  it("выход — порции по-русски и дробные; у изделий свои формы слова", () => {
    expect(yieldLabel(1)).toBe("1 порция");
    expect(yieldLabel(2)).toBe("2 порции");
    expect(yieldLabel(5)).toBe("5 порций");
    expect(yieldLabel(2.5)).toBe("2,5 порции");
    expect(yieldLabel(1.76)).toBe("1,8 порции");
    const waffles = ["вафля", "вафли", "вафель"] as const;
    expect(yieldLabel(1, waffles)).toBe("1 вафля");
    expect(yieldLabel(4, waffles)).toBe("4 вафли");
    expect(yieldLabel(8, waffles)).toBe("8 вафель");
    expect(yieldLabel(21, waffles)).toBe("21 вафля");
  });

  it("ложки и штуки — простыми дробями, только при точном равенстве", () => {
    expect(formatAmount(0.5, "ч. л.")).toBe("½");
    expect(formatAmount(0.25, "ч. л.")).toBe("¼");
    expect(formatAmount(1.5, "ст. л.")).toBe("1½");
    expect(formatAmount(1 / 3, "шт.")).toBe("⅓");
    expect(formatAmount(2, "шт.")).toBe("2");
    expect(formatAmount(0.249, "ч. л.")).not.toBe("¼");
    expect(formatAmount(0.364, "ч. л.")).toBe("0,36");
    expect(formatAmount(137.5, "г")).toBe("137,5");
  });

  it("количество строки: точное, диапазон с обеих сторон, «по желанию» не пересчитывается", () => {
    expect(formatQuantity({ kind: "exact", value: 50 }, 2, "г")).toBe("100");
    expect(formatQuantity({ kind: "range", min: 0.5, max: 1 }, 1, "ч. л.")).toBe("½–1");
    expect(formatQuantity({ kind: "range", min: 0.5, max: 1 }, 2, "ч. л.")).toBe("1–2");
    expect(formatQuantity({ kind: "range", min: 0.5, max: 1 }, 0.5, "ч. л.")).toBe("¼–½");
    expect(formatQuantity({ kind: "none" }, 2)).toBeNull();
  });

  it("количество — без кулинарного округления, до десятых", () => {
    expect(formatAmount(26.4)).toBe("26,4");
    expect(formatAmount(0.5)).toBe("0,5");
    expect(formatAmount(1500)).toBe("1\u00a0500");
    expect(formatAmount(0.002)).toBe("0,002");
    expect(formatAmount(0.125)).toBe("0,13");
  });

  it("значение поля ввода — без пробела между тысячами и снова читается", () => {
    expect(formatInput(1500)).toBe("1500");
    expect(formatInput(1.5)).toBe("1,5");
    expect(parseAmount(formatInput(1500), 1500)).toEqual({ ok: true, value: 1500 });
  });
});
