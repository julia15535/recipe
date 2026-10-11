import { describe, expect, it } from "vitest";

import { toggleStyle } from "./format-edit";
import { inlineRuns } from "./inline";

const at = (text: string, word: string) => ({ text, start: text.indexOf(word), end: text.indexOf(word) + word.length });

describe("кнопки «Ж» и «К»", () => {
  it("выделенное слово → жирный, ещё раз → снято; выделение остаётся на словах", () => {
    const bold = toggleStyle(at("Добавьте соль в конце.", "соль"), "bold");
    expect(bold).toEqual({ text: "Добавьте **соль** в конце.", start: 11, end: 15 });
    expect(toggleStyle(bold, "bold")).toEqual({ text: "Добавьте соль в конце.", start: 9, end: 13 });
  });

  it("жирный + курсив = оба; снять курсив — остаётся жирный; пробелы по краям выделения не захватываются", () => {
    const bold = toggleStyle({ text: "одно слово", start: 4, end: 10 }, "bold");
    const both = toggleStyle(bold, "italic");
    expect(both.text).toBe("одно ***слово***");
    expect(inlineRuns(both.text).at(-1)).toEqual({ text: "слово", bold: true, italic: true });
    expect(toggleStyle(both, "italic").text).toBe("одно **слово**");
    expect(toggleStyle({ text: "a  важно  b", start: 1, end: 9 }, "italic").text).toBe("a  *важно*  b");
  });

  it("выделили вместе со звёздочками — тоже снимается; без выделения — пара знаков, курсор между", () => {
    expect(toggleStyle({ text: "**соль**", start: 0, end: 8 }, "bold")).toEqual({ text: "соль", start: 0, end: 4 });
    expect(toggleStyle({ text: "ab", start: 1, end: 1 }, "italic")).toEqual({ text: "a**b", start: 2, end: 2 });
  });

  it("несколько строк — каждая отдельно, пустые пропускаются", () => {
    const text = "первая строка\n\nвторая";
    expect(toggleStyle({ text, start: 0, end: text.length }, "bold")).toEqual({ text: "**первая строка**\n\n**вторая**", start: 0, end: 29 });
  });
});
