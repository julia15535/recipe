import { describe, expect, it } from "vitest";

import { toggleStyle } from "./format-edit";
import { inlineRuns, type Run } from "./inline";
import { normalizeText } from "./lines";
import { parseArticle } from "./parse";
import { articleUnits, composeArticle, fromTagged, tagSequence, toTagged } from "./translation";

describe("перевод статьи: метки оформления", () => {
  it("звёздочки → метки → звёздочки: жирный, курсив, вложенность, одиночная звёздочка", () => {
    for (const [stars, tagged] of [
      ["Добавьте **соль** в *конце*.", "Добавьте ⟪b⟫соль⟪/b⟫ в ⟪i⟫конце⟪/i⟫."],
      ["*а **б** в*", "⟪i⟫а ⟪b⟫б⟪/b⟫ в⟪/i⟫"],
      ["***оба***", "⟪b⟫⟪i⟫оба⟪/i⟫⟪/b⟫"],
      ["*Овёс без глютена", "⟪*⟫Овёс без глютена"],
    ] as const) {
      expect(toTagged(stars), stars).toBe(tagged);
      const back = fromTagged(tagged) ?? "";
      expect(inlineRuns(back), stars).toEqual(inlineRuns(stars));
    }
  });

  it("пробелы внутри меток выносятся наружу; перепутанные метки — null", () => {
    expect(fromTagged("Add ⟪b⟫ salt ⟪/b⟫ last.")).toBe("Add **salt** last.");
    expect(fromTagged("⟪b⟫a⟪i⟫b⟪/b⟫⟪/i⟫")).toBeNull();
    expect(fromTagged("⟪b⟫a")).toBeNull();
    expect(tagSequence("x ⟪b⟫y⟪/b⟫ ⟪*⟫")).toEqual(["b", "/b", "*"]);
  });
});

describe("перевод статьи: единицы и сборка", () => {
  const text = normalizeText("# Бананы **спелые**\nДва *очень* спелых банана.\n\n- мёд\n- **финики**\n\n[Фото Q7K2]");
  const source = { title: "Чем заменить сахар", body: parseArticle(text, null).body, captions: { Q7K2: "Бананы *на столе*" } };

  it("единицы: название, заголовок без оформления, абзац и пункты с метками, подпись без оформления", () => {
    expect(articleUnits(source)).toEqual([
      { id: "title", text: "Чем заменить сахар" },
      { id: "b1", text: "Бананы спелые" },
      { id: "b2", text: "Два ⟪i⟫очень⟪/i⟫ спелых банана." },
      { id: "b3:0", text: "мёд" },
      { id: "b3:1", text: "⟪b⟫финики⟪/b⟫" },
      { id: "photo:Q7K2", text: "Бананы на столе" },
    ]);
  });

  it("сборка: та же структура, тексты английские, оформление звёздочками", () => {
    const answer = [
      { id: "title", text: "How to replace sugar" },
      { id: "b1", text: "Ripe bananas" },
      { id: "b2", text: "Two ⟪i⟫very⟪/i⟫ ripe bananas." },
      { id: "b3:0", text: "honey" },
      { id: "b3:1", text: "⟪b⟫dates⟪/b⟫" },
      { id: "photo:Q7K2", text: "Bananas on the table" },
    ];
    const result = composeArticle(source, answer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.article.title).toBe("How to replace sugar");
    expect(result.article.captions).toEqual({ Q7K2: "Bananas on the table" });
    expect(result.article.body.blocks.map((block) => block.type)).toEqual(source.body.blocks.map((block) => block.type));
    expect(result.article.body.blocks[1]).toMatchObject({ type: "paragraph", text: "Two *very* ripe bananas." });
    expect(result.article.body.blocks[2]).toMatchObject({ type: "list", items: [{ text: "honey" }, { text: "**dates**" }] });
  });

  it("отказ: пропуск, лишнее, перестановка, пустой текст, потерянная метка", () => {
    const good = articleUnits(source).map((unit) => ({ ...unit, text: `EN ${unit.text}` }));
    expect(composeArticle(source, good).ok).toBe(true);
    expect(composeArticle(source, good.slice(1))).toEqual({ ok: false, reason: "structure" });
    expect(composeArticle(source, [...good, { id: "x", text: "x" }])).toEqual({ ok: false, reason: "structure" });
    expect(composeArticle(source, [good[1], good[0], ...good.slice(2)].filter((unit) => unit !== undefined))).toEqual({ ok: false, reason: "structure" });
    expect(composeArticle(source, good.map((unit) => (unit.id === "b1" ? { ...unit, text: " " } : unit)))).toEqual({ ok: false, reason: "structure" });
    expect(composeArticle(source, good.map((unit) => (unit.id === "b2" ? { ...unit, text: "Two very ripe bananas." } : unit)))).toEqual({ ok: false, reason: "formatting" });
  });
});

describe("перевод статьи: туда-обратно на случайном оформлении", () => {
  it("50 серий × 40 нажатий «Ж»/«К» — после меток и обратно у каждой буквы то же оформление", () => {
    const letters = (runs: Run[]) => runs.flatMap((run) => [...run.text].filter((c) => !/\s/u.test(c)).map((c) => `${c}${run.bold ? "b" : ""}${run.italic ? "i" : ""}`)).join("");
    const source = "Мука (цельнозерновая) — «лучшая» для кексов! *Овёс без глютена, 5*3 яблока; ура?";
    for (let series = 1; series <= 50; series += 1) {
      let seed = series;
      const random = (n: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
      let text = source;
      for (let step = 0; step < 40; step += 1) {
        const a = random(text.length);
        text = toggleStyle({ text, start: a, end: a + 1 + random(text.length - a) }, random(2) ? "bold" : "italic").text;
        const back = fromTagged(toTagged(text));
        expect(back, text).not.toBeNull();
        expect(letters(inlineRuns(back ?? "")), `${text} → ${back}`).toBe(letters(inlineRuns(text)));
      }
    }
  });
});

