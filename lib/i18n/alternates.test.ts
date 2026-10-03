import { describe, expect, it } from "vitest";

import { pageAlternates, samePathAlternates } from "./alternates";

describe("canonical и hreflang", () => {
  it("главная: оба языка и x-default на корень", () => {
    expect(samePathAlternates("en", "/")).toEqual({ canonical: "/en", languages: { ru: "/ru", en: "/en", "x-default": "/" } });
  });

  it("поиск: тот же путь на обоих языках, без x-default", () => {
    expect(samePathAlternates("ru", "/search")).toEqual({ canonical: "/ru/search", languages: { ru: "/ru/search", en: "/en/search" } });
  });

  it("рецепт: адреса языков разные; без перевода — только ru", () => {
    expect(pageAlternates("ru", { ru: "/ru/recipe/vafli", en: "/en/recipe/waffles" })).toEqual({
      canonical: "/ru/recipe/vafli",
      languages: { ru: "/ru/recipe/vafli", en: "/en/recipe/waffles" },
    });
    expect(pageAlternates("ru", { ru: "/ru/recipe/vafli" })).toEqual({ canonical: "/ru/recipe/vafli", languages: { ru: "/ru/recipe/vafli" } });
  });
});
