import { describe, expect, it } from "vitest";

import { recognizeCatalogWord } from "./catalog";
import { parseRecipeText } from "./recipe-text/parse";

describe("слова строки «Теги:» — теги состава", () => {
  it("«Омега-3»: три написания, дефис из редактора, регистр и точка в конце", () => {
    for (const word of ["омега-3", "Омега 3", "ОМЕГА3", "омега‑3", "омега–3", "омега-3."]) {
      expect(recognizeCatalogWord(word), word).toEqual({ kind: "tag", code: "omega-3" });
    }
  });

  it("«Антиоксиданты» — и в единственном числе", () => {
    for (const word of ["антиоксиданты", "Антиоксидант"]) expect(recognizeCatalogWord(word), word).toEqual({ kind: "tag", code: "antioxidants" });
  });

  it("похожее — не тег: просто «омега», омега-6, «3-6-9», «антиоксидантный»", () => {
    for (const word of ["омега", "омега-6", "омега 3-6-9", "антиоксидантный"]) expect(recognizeCatalogWord(word), word).toBeNull();
  });

  it("в рецепте: оба тега в порядке автора, неизвестное — подсказка со всеми семью тегами", () => {
    const parsed = parseRecipeText("Смузи\nТеги: напиток, антиоксиданты, омега-3, омега-6\nИнгредиенты:\n- Черника — 150 г - основной\nПриготовление:\n1. Взбить.");
    expect(parsed.draft.tags).toEqual(["antioxidants", "omega-3"]);
    const hint = parsed.issues.find((item) => item.code === "unknown-tag");
    expect(hint?.message).toContain("«омега-6»");
    expect(hint?.message).toContain("теги: белок, клетчатка, полезные жиры, омега-3, мало сахара, железо, антиоксиданты.");
  });
});
