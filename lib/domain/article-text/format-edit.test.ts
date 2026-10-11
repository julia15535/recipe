import { describe, expect, it } from "vitest";

import { toggleStyle } from "./format-edit";
import { inlineRuns, plainText } from "./inline";

const at = (text: string, word: string) => ({ text, start: text.indexOf(word), end: text.indexOf(word) + word.length });
// Что бы ни нажимали — на сайте ни одной звёздочки.
const clean = (text: string) => expect(text.split("\n").map(plainText).join("\n"), text).not.toContain("*");

describe("кнопки «Ж» и «К»", () => {
  it("выделенное слово → жирный, ещё раз → снято; выделение остаётся на словах", () => {
    const bold = toggleStyle(at("Добавьте соль в конце.", "соль"), "bold");
    expect(bold).toEqual({ text: "Добавьте **соль** в конце.", start: 11, end: 15 });
    expect(toggleStyle(bold, "bold")).toEqual({ text: "Добавьте соль в конце.", start: 9, end: 13 });
  });

  it("жирный + курсив = оба; снять курсив — остаётся жирный; пробелы по краям не захватываются", () => {
    const both = toggleStyle(toggleStyle({ text: "одно слово", start: 4, end: 10 }, "bold"), "italic");
    expect(both.text).toBe("одно ***слово***");
    expect(inlineRuns(both.text).at(-1)).toEqual({ text: "слово", bold: true, italic: true });
    expect(toggleStyle(both, "italic").text).toBe("одно **слово**");
    expect(toggleStyle({ text: "a  важно  b", start: 1, end: 9 }, "italic").text).toBe("a  *важно*  b");
  });

  it("курсив фразы, потом жирное слово внутри — вложенность показывается без звёздочек", () => {
    const italic = toggleStyle(at("а очень важно в", "очень важно"), "italic");
    const nested = toggleStyle(at(italic.text, "важно"), "bold");
    expect(nested.text).toBe("а *очень **важно***  в".replace("  ", " "));
    expect(inlineRuns(nested.text)).toEqual([
      { text: "а ", bold: false, italic: false },
      { text: "очень ", bold: false, italic: true },
      { text: "важно", bold: true, italic: true },
      { text: " в", bold: false, italic: false },
    ]);
  });

  it("часть слова — до целого слова; часть жирного куска — «Ж» снимает весь кусок", () => {
    expect(toggleStyle({ text: "пересоль", start: 4, end: 8 }, "bold").text).toBe("**пересоль**");
    expect(toggleStyle(at("**один два**", "два"), "bold").text).toBe("один два");
  });

  it("выделили вместе со звёздочками — тоже снимается; без выделения — пара знаков, повтор убирает пару", () => {
    expect(toggleStyle({ text: "**соль**", start: 0, end: 8 }, "bold")).toEqual({ text: "соль", start: 0, end: 4 });
    const empty = toggleStyle({ text: "ab", start: 1, end: 1 }, "italic");
    expect(empty).toEqual({ text: "a**b", start: 2, end: 2 });
    expect(toggleStyle(empty, "italic")).toEqual({ text: "ab", start: 1, end: 1 });
  });

  it("несколько строк: значки пунктов, «#» и метка фото не оборачиваются, пустые строки пропускаются", () => {
    const text = "# Заголовок\n- ветчина\n1. огурец\n\n[Фото Q7K2]\nабзац";
    const result = toggleStyle({ text, start: 0, end: text.length }, "bold");
    expect(result.text).toBe("# **Заголовок**\n- **ветчина**\n1. **огурец**\n\n[Фото Q7K2]\n**абзац**");
    clean(result.text);
  });

  it("пересекающиеся выделения поглощаются — звёздочек на сайте нет", () => {
    for (const [text, word, style] of [
      ["**один два** три", "два три", "italic"],
      ["*один два* три", "два три", "italic"],
      ["раз **два** три", "раз **два", "bold"],
    ] as const) clean(toggleStyle(at(text, word), style).text);
  });

  it("случайные выделения и нажатия (100 серий по 200) — на сайте те же слова, ни одной лишней звёздочки", () => {
    const sources = [
      "# Как подать вафли\nВафли можно подать по-разному, с рыбой.\n- ветчина и огурец\n\n[Фото Q7K2]\n1. сыр, зелень",
      "Мука (цельнозерновая) — «лучшая» для кексов!\n*Овёс без глютена, но может содержать следы.\nЁжик ест 5*3 яблока; ура?",
    ];
    for (const source of sources) {
      const visible = (text: string) => text.split("\n").map(plainText).join("\n");
      const base = visible(source);
      for (let series = 1; series <= 50; series += 1) {
        let seed = series;
        const random = (n: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
        let text = source;
        for (let step = 0; step < 200; step += 1) {
          // Пустое выделение — вставка пары под набор текста, проверена отдельно.
          const a = random(text.length);
          const b = a + 1 + random(text.length - a);
          text = toggleStyle({ text, start: a, end: b }, random(2) ? "bold" : "italic").text;
          expect(visible(text), `серия ${series}, шаг ${step}: ${text}`).toBe(base);
        }
      }
    }
  });
});
