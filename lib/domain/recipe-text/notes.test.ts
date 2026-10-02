import { describe, expect, it } from "vitest";

import { fraction } from "../fraction";
import { withoutWeight } from "./notes";

const one = { kind: "exact", amount: fraction(1) } as const;

describe("пометка без примерного веса", () => {
  it.each([
    ["примерно 3 г", null],
    ["примерно 75 мл / 65–70 г", null],
    ["280 г", null],
    ["70–80 г", null],
    ["примерно 2–3 г", null],
    ["≈ 1/2 кг", null],
    ["если творог сухой", "если творог сухой"],
    ["цедра и сок", "цедра и сок"],
    ["с горкой, примерно 15 г", "с горкой"],
  ])("«%s» → %s", (note, expected) => {
    expect(withoutWeight(note, one)).toBe(expected);
  });

  it("без количества пометка остаётся целиком", () => {
    expect(withoutWeight("на кончике ножа, примерно 1 г", { kind: "none" })).toBe("на кончике ножа, примерно 1 г");
  });
});
