import { describe, expect, it } from "vitest";

import { localizedAlternates } from "./alternates";

describe("localizedAlternates", () => {
  it("главная: canonical на свою локаль, x-default — корень", () => {
    expect(localizedAlternates("en", "/")).toEqual({
      canonical: "/en",
      languages: { ru: "/ru", en: "/en", "x-default": "/" },
    });
  });

  it("вложенная страница: все языки на тот же путь", () => {
    expect(localizedAlternates("ru", "/recipes/syrniki")).toEqual({
      canonical: "/ru/recipes/syrniki",
      languages: { ru: "/ru/recipes/syrniki", en: "/en/recipes/syrniki", "x-default": "/recipes/syrniki" },
    });
  });
});
