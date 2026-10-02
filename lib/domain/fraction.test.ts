import { describe, expect, it } from "vitest";

import { compare, div, fraction, mul, parseDecimal, parseNumber, toNumber } from "./fraction";

describe("точные дроби", () => {
  it("сокращаются и хранят треть точно", () => {
    expect(fraction(2, 6)).toEqual({ num: 1, den: 3 });
    expect(mul(fraction(1, 3), fraction(3))).toEqual({ num: 1, den: 1 });
    expect(div(fraction(1, 2), fraction(3, 2))).toEqual({ num: 1, den: 3 });
    expect(compare(fraction(1, 3), fraction(2, 6))).toBe(0);
    expect(compare(fraction(1, 2), fraction(1, 3))).toBe(1);
  });

  it("десятичная запись — точно: 0,125 = 1/8, «2.5» = 5/2", () => {
    expect(parseDecimal("0,125")).toEqual({ num: 1, den: 8 });
    expect(parseDecimal("2.5")).toEqual({ num: 5, den: 2 });
    expect(parseDecimal("275")).toEqual({ num: 275, den: 1 });
    expect(parseDecimal("1,2,3")).toBeNull();
    expect(parseDecimal("-5")).toBeNull();
  });

  it("число из рецепта: «½», «1½», «⅓», «1/2», «1 1/2»", () => {
    expect(parseNumber("½")).toEqual({ num: 1, den: 2 });
    expect(parseNumber("1½")).toEqual({ num: 3, den: 2 });
    expect(parseNumber("1 ⅓")).toEqual({ num: 4, den: 3 });
    expect(parseNumber("⅔")).toEqual({ num: 2, den: 3 });
    expect(parseNumber("1/2")).toEqual({ num: 1, den: 2 });
    expect(parseNumber("1 1/2")).toEqual({ num: 3, den: 2 });
    expect(parseNumber("1/0")).toBeNull();
    expect(parseNumber("пол")).toBeNull();
  });

  it("длинная цепочка умножений не переполняется — остаётся близкой", () => {
    let value = fraction(1, 3);
    for (let i = 0; i < 40; i += 1) value = mul(value, fraction(999_983, 999_979));
    expect(Number.isSafeInteger(value.num) && Number.isSafeInteger(value.den)).toBe(true);
    expect(toNumber(value)).toBeCloseTo((1 / 3) * (999_983 / 999_979) ** 40, 4);
  });
});
