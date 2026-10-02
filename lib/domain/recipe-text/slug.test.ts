import { describe, expect, it } from "vitest";

import { SLUG_MAX, SLUG_PATTERN, slugify } from "./slug";

describe("адрес рецепта из названия", () => {
  it("транслит, ё, регистр и знаки", () => {
    expect(slugify("Творожные вафли")).toBe("tvorozhnye-vafli");
    expect(slugify("Ёжики в томате!")).toBe("ezhiki-v-tomate");
    expect(slugify("Щи «Суточные» — 2 вида")).toBe("shchi-sutochnye-2-vida");
  });

  it("только латиница, цифры и дефисы; не длиннее предела; пусто → null", () => {
    const long = slugify("Очень ".repeat(40)) ?? "";
    expect(long.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(long).toMatch(SLUG_PATTERN);
    expect(slugify("!!!")).toBeNull();
  });
});
