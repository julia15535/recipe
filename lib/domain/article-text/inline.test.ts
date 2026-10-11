import { describe, expect, it } from "vitest";

import { inlineRuns, plainText } from "./inline";

const r = (text: string, bold = false, italic = false) => ({ text, bold, italic });

describe("жирный и курсив в тексте статьи", () => {
  it("пары: жирный, курсив, оба; знаки препинания рядом", () => {
    expect(inlineRuns("**жирный**")).toEqual([r("жирный", true)]);
    expect(inlineRuns("*курсив*")).toEqual([r("курсив", false, true)]);
    expect(inlineRuns("***оба***")).toEqual([r("оба", true, true)]);
    expect(inlineRuns("Привет, **мир**! И *ещё* раз.")).toEqual([r("Привет, "), r("мир", true), r("! И "), r("ещё", false, true), r(" раз.")]);
  });

  it("как есть: формулы, внутри слова, у пробела, непарные, длинные, пустые", () => {
    for (const text of ["5*3", "5 * 3", "5*3*2", "до**важно**после", "слово*", "* слово*", "*слово *", "**", "****", "** **", "*a"]) {
      expect(plainText(text), text).toBe(text);
      expect(inlineRuns(text).every((run) => !run.bold && !run.italic), text).toBe(true);
    }
  });

  it("вложенность разного вида; непарная звёздочка не мешает другим; сноска перед запятой — как есть; «\\*» — звёздочка", () => {
    expect(inlineRuns("**жирный *курсив***")).toEqual([r("жирный ", true), r("курсив", true, true)]);
    expect(inlineRuns("*а **б** в*")).toEqual([r("а ", false, true), r("б", true, true), r(" в", false, true)]);
    expect(inlineRuns("*сноска и **важно**")).toEqual([r("*сноска и "), r("важно", true)]);
    expect(plainText("Мука*, сахар*")).toBe("Мука*, сахар*");
    expect(inlineRuns("\\*сноска\\* и *курсив*")).toEqual([r("*сноска* и "), r("курсив", false, true)]);
  });

  it("несколько выделений подряд и в конце фразы", () => {
    expect(inlineRuns("*а* и **б**")).toEqual([r("а", false, true), r(" и "), r("б", true)]);
    expect(plainText("Важно: **соль в конце**.")).toBe("Важно: соль в конце.");
  });
});
