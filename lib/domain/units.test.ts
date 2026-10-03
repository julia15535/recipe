import { describe, expect, it } from "vitest";

import { fraction } from "./fraction";
import { formatAmount, formatInput, yieldLabel, SERVINGS_EN } from "./rescale";
import { unitLabel } from "./units";

describe("единицы и числа по языку", () => {
  it("по-английски: g/ml/tsp/tbsp, cup/cups, штуки без единицы; авторская — свои формы; по-русски — как в данных", () => {
    expect(unitLabel("г", "en", 250)).toBe("g");
    expect(unitLabel("ч. л.", "en", 0.5)).toBe("tsp");
    expect(unitLabel("стак.", "en", 1)).toBe("cup");
    expect(unitLabel("стак.", "en", 1.5)).toBe("cups");
    expect(unitLabel("шт.", "en", 2)).toBeNull();
    expect(unitLabel("горсть", "en", 2, ["handful", "handfuls"])).toBe("handfuls");
    expect(unitLabel("ст. л.", "ru", 2)).toBe("ст. л.");
    expect(unitLabel(null, "en", 2)).toBeNull();
  });

  it("числа: по-русски запятая, по-английски точка; выход — английские формы", () => {
    expect(formatAmount(fraction(5, 2), "г", "ru")).toBe("2,5");
    expect(formatAmount(fraction(5, 2), "г", "en")).toBe("2.5");
    expect(formatInput(fraction(5, 2), "en")).toBe("2.5");
    expect(yieldLabel(fraction(1), SERVINGS_EN, "en")).toBe("1 serving");
    expect(yieldLabel(fraction(5, 2), SERVINGS_EN, "en")).toBe("2.5 servings");
    expect(yieldLabel(fraction(4), ["waffle", "waffles"], "en")).toBe("4 waffles");
    expect(yieldLabel(fraction(5), ["вафля", "вафли", "вафель"], "ru")).toBe("5 вафель");
  });
});
