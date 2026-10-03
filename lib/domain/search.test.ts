import { describe, expect, it } from "vitest";

import { hasCriteria, ingredientChips, matches, normalize, paramsFromQuery, queryFromParams, rankedChips, type SearchQuery } from "./search";

const base: SearchQuery = { mode: "recipe", text: "", ingredients: [], section: null, tags: [] };
const kekS = { title: "Морковный кекс", ingredients: ["Яйца", "Морковь сырая, тёртая", "Мука цельнозерновая пшеничная"], sections: ["baking"], tags: ["fiber"] };
const vafli = { title: "Творожные вафли", ingredients: ["Творог 0,5%", "Яйца", "Чёрный перец / итальянские травы / паприка"], sections: ["breakfast"], tags: ["protein"] };

describe("поиск", () => {
  it("нормализация: регистр, ё, пробелы, NFKC", () => {
    expect(normalize("  Чёрный   ПЕРЕЦ ")).toBe("черный перец");
    expect(normalize("ﬁ")).toBe("fi");
  });

  it("таблетки ингредиентов: без процентов, скобок и уточнений после запятой; «/», «или» — отдельно; без повторов", () => {
    expect(ingredientChips(["Творог 0,5%", "творог", "Чёрный перец / итальянские травы / паприка", "Грецкие орехи или фундук", "Морковь сырая, тёртая", "Масло (сливочное)"])).toEqual([
      "Грецкие орехи",
      "Итальянские травы",
      "Масло",
      "Морковь сырая",
      "Паприка",
      "Творог",
      "Фундук",
      "Чёрный перец",
    ]);
  });

  it("таблетки по частоте: сначала общие для большего числа рецептов, при равенстве — по алфавиту; «ё» не дублирует", () => {
    expect(rankedChips([kekS.ingredients, vafli.ingredients, ["Черный перец", "Яйцо"]])).toEqual([
      "Чёрный перец",
      "Яйца",
      "Итальянские травы",
      "Морковь сырая",
      "Мука цельнозерновая пшеничная",
      "Паприка",
      "Творог",
      "Яйцо",
    ]);
  });

  it("по названию — без учёта регистра и «ё»; по ингредиентам — все выбранные («И»)", () => {
    expect(matches(vafli, { ...base, text: "ВАФЛИ" })).toBe(true);
    expect(matches(vafli, { ...base, text: "кекс" })).toBe(false);
    expect(matches(vafli, { ...base, mode: "ingredient", ingredients: ["Творог", "Яйца"] })).toBe(true);
    expect(matches(kekS, { ...base, mode: "ingredient", ingredients: ["Творог", "Яйца"] })).toBe(false);
    expect(matches(vafli, { ...base, mode: "ingredient", ingredients: ["Черный перец"] })).toBe(true);
  });

  it("раздел и теги уточняют", () => {
    expect(matches(kekS, { ...base, section: "baking", tags: ["fiber"] })).toBe(true);
    expect(matches(kekS, { ...base, section: "breakfast" })).toBe(false);
    expect(matches(kekS, { ...base, tags: ["fiber", "protein"] })).toBe(false);
    expect(hasCriteria(base)).toBe(false);
    expect(hasCriteria({ ...base, tags: ["fiber"] })).toBe(true);
  });

  it("адрес ↔ состояние: туда и обратно; неизвестный раздел и тег отбрасываются", () => {
    const query: SearchQuery = { mode: "ingredient", text: "тво", ingredients: ["Яйца", "Творог"], section: "breakfast", tags: ["protein"] };
    const text = paramsFromQuery(query);
    expect(text).toBe("?by=ingredient&q=%D1%82%D0%B2%D0%BE&i=%D0%A2%D0%B2%D0%BE%D1%80%D0%BE%D0%B3&i=%D0%AF%D0%B9%D1%86%D0%B0&section=breakfast&tag=protein");
    expect(queryFromParams(new URLSearchParams(text), ["breakfast"], ["protein"])).toEqual({ ...query, ingredients: ["Творог", "Яйца"] });
    expect(queryFromParams(new URLSearchParams("section=pizza&tag=fat&by=x"), ["breakfast"], ["protein"])).toEqual(base);
    expect(paramsFromQuery(base)).toBe("");
  });
});

describe("поиск по-английски", () => {
  it("«or» делит таблетки, сортировка по-английски", () => {
    expect(ingredientChips(["Walnuts or hazelnuts", "Black pepper / herbs", "Cottage cheese 0.5%"], "en")).toEqual([
      "Black pepper",
      "Cottage cheese",
      "Hazelnuts",
      "Herbs",
      "Walnuts",
    ]);
  });
});
