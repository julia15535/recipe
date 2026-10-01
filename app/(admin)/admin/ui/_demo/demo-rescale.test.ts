import { describe, expect, it } from "vitest";

import { MAX_FACTOR, formatAmount, formatInput, parseAmount, servingsLabel } from "./demo-rescale";

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

  it("порции — по-русски и дробные", () => {
    expect(servingsLabel(1)).toBe("1 порция");
    expect(servingsLabel(2)).toBe("2 порции");
    expect(servingsLabel(5)).toBe("5 порций");
    expect(servingsLabel(2.5)).toBe("2,5 порции");
    expect(servingsLabel(1.76)).toBe("1,8 порции");
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
