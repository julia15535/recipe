import { describe, expect, it } from "vitest";

import { localizedAlternates } from "./alternates";

describe("localizedAlternates", () => {
  it("главная: canonical на свою локаль, hreflang — только русская версия (английской пока нет)", () => {
    expect(localizedAlternates("ru", "/")).toEqual({ canonical: "/ru", languages: { ru: "/ru" } });
  });

  it("вложенная страница: тот же путь, без en и x-default", () => {
    expect(localizedAlternates("ru", "/recipe/vafli")).toEqual({
      canonical: "/ru/recipe/vafli",
      languages: { ru: "/ru/recipe/vafli" },
    });
  });
});
