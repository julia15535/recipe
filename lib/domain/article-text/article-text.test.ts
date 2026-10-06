import { describe, expect, it } from "vitest";

import { assemble, excerptOf, marksValid } from "./assemble";
import { insertMarker, lastLineOf, remap, removeMarker } from "./edit";
import { contentLines, newPhotoKey, normalizeText, readLines } from "./lines";
import { parseArticle, titleIssue } from "./parse";
import { plainMarks } from "./plain";
import type { Mark } from "./types";

const WAFFLES = normalizeText(`Вафли можно подать по-разному.
Вот три любимых варианта 🧇

# С творожным сыром и рыбой
Намажьте вафлю творожным сыром,
сверху — ломтики слабосолёной рыбы.

[Фото Q7K2]

## С ветчиной
- ветчина
- огурец
- зелень

[Фото W3XR]

1. Подогрейте вафлю.
2) Выложите начинку.`);

describe("статья: строки и метки фото", () => {
  it("метки — только целой строкой; повтор, «внутри абзаца» и больше 10 — нужно решить", () => {
    const { markers, issues } = readLines(WAFFLES);
    expect([...markers.values()]).toEqual(["Q7K2", "W3XR"]);
    expect(issues).toEqual([]);
    expect(readLines("Текст\n[Фото Q7K2]\n[фото q7k2]").issues.map((i) => i.text)).toEqual(["Метка «[Фото Q7K2]» стоит дважды — оставьте одну."]);
    expect(readLines("Вкусно [Фото Q7K2] очень").issues[0]?.text).toMatch(/отдельной строкой/);
    const eleven = Array.from({ length: 11 }, (_, i) => `[Фото AAA${"BCDEFGHJKLM"[i]}]`).join("\n");
    expect(readLines(`Текст\n${eleven}`).issues.some((i) => i.text.startsWith("Фото больше 10"))).toBe(true);
  });

  it("нормализация: CRLF, NFC, пробелы в конце строк; смайлики и «ё» — как есть", () => {
    expect(normalizeText("Ёжик 🧇  \r\nвторая \r\n\r\n")).toBe("Ёжик 🧇\nвторая");
    expect(normalizeText("é")).toBe("é");
  });

  it("код фото — 4 знака без похожих (0/O, 1/I), не из занятых", () => {
    const values = [0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99];
    const key = newPhotoKey(new Set(["AAAA"]), () => values.shift() ?? 0.5);
    expect(key).toBe("9999");
    expect(newPhotoKey(new Set())).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe("статья: разбор без ИИ", () => {
  it("заголовки по «#», списки по «-» и «1.», абзацы по пустой строке; фото по меткам; слова — как у автора", () => {
    const { ok, body, byAi } = parseArticle(WAFFLES, null);
    expect(ok).toBe(true);
    expect(byAi).toBe(false);
    expect(body.blocks.map((block) => block.type)).toEqual(["paragraph", "heading", "paragraph", "photo", "heading", "list", "photo", "list"]);
    expect(body.blocks[0]).toMatchObject({ text: "Вафли можно подать по-разному. Вот три любимых варианта 🧇", from: 0, to: 1 });
    expect(body.blocks[1]).toMatchObject({ level: 2, text: "С творожным сыром и рыбой" });
    expect(body.blocks[2]).toMatchObject({ text: "Намажьте вафлю творожным сыром, сверху — ломтики слабосолёной рыбы." });
    expect(body.blocks[3]).toMatchObject({ type: "photo", key: "Q7K2" });
    expect(body.blocks[5]).toMatchObject({ type: "list", ordered: false, items: [{ text: "ветчина" }, { text: "огурец" }, { text: "зелень" }] });
    expect(body.blocks[7]).toMatchObject({ type: "list", ordered: true, items: [{ text: "Подогрейте вафлю." }, { text: "Выложите начинку." }] });
  });

  it("«###» — подзаголовок; реплика «— …» — абзац, тире на месте; пустой текст — нужно решить", () => {
    expect(parseArticle("— Привет!\n— Привет.", null).body.blocks).toMatchObject([{ type: "paragraph", text: "— Привет! — Привет." }]);
    expect(plainMarks(readLines("### Мелко\nтекст"))).toEqual([
      { kind: "h3", from: 0, to: 0 },
      { kind: "p", from: 1, to: 1 },
    ]);
    expect(parseArticle("[Фото Q7K2]", null).issues.map((i) => i.text)).toContain("В статье нет текста.");
  });
});

describe("статья: разметка ИИ проверяется", () => {
  const source = readLines(WAFFLES);
  const good = plainMarks(source);

  it("каждая строка с текстом — ровно один раз и по порядку; заголовок — одна строка", () => {
    expect(marksValid(source, good)).toBe(true);
    expect(marksValid(source, good.slice(1))).toBe(false); // пропуск строк
    expect(marksValid(source, [...good, { kind: "p", from: 0, to: 0 }])).toBe(false); // повтор
    expect(marksValid(source, [{ kind: "p", from: 0, to: 4 }, ...good.slice(2)])).toBe(false); // через пустую строку
    expect(marksValid(source, [{ kind: "h2", from: 0, to: 1 }, ...good.slice(1)])).toBe(false); // заголовок в 2 строки
    expect(marksValid(source, [...good.slice(0, 3), { kind: "p", from: 5, to: 7 }, ...good.slice(4)])).toBe(false); // через метку
  });

  it("разметка ИИ легла — блоки по ней; не легла — разбор без ИИ и замечание", () => {
    const ai: Mark[] = good.map((mark, index) => (index === 1 ? { ...mark, kind: "h3" } : mark));
    const parsed = parseArticle(WAFFLES, ai);
    expect(parsed.byAi).toBe(true);
    expect(parsed.body.blocks[1]).toMatchObject({ type: "heading", level: 3 });
    const broken = parseArticle(WAFFLES, good.slice(1));
    expect(broken.byAi).toBe(false);
    expect(broken.ok).toBe(true);
    expect(broken.issues[0]?.text).toMatch(/разобрано без ИИ/);
  });

  it("ИИ назвал абзац пунктом без значка — текст не теряется; пустой «-» — без пустого пункта", () => {
    const text = "Первое\n-\nВторое";
    const { body } = assemble(readLines(text), [
      { kind: "bullet", from: 0, to: 0 },
      { kind: "bullet", from: 1, to: 1 },
      { kind: "p", from: 2, to: 2 },
    ]);
    expect(body.blocks).toMatchObject([{ type: "list", items: [{ text: "Первое" }] }, { type: "paragraph", text: "Второе" }]);
  });
});

describe("статья: слова автора и её нумерация", () => {
  it("нумерованный список после фото продолжается с номера автора; неразрывные и двойные пробелы внутри строки — как есть", () => {
    const { body } = parseArticle("1. Первое\n2. Второе\n\n[Фото Q7K2]\n\n3. Третье\n\nЦена:\u00A0100\u00A0₽ и  ещё", null);
    expect(body.blocks).toMatchObject([
      { type: "list", ordered: true, items: [{ text: "Первое" }, { text: "Второе" }] },
      { type: "photo" },
      { type: "list", ordered: true, start: 3, items: [{ text: "Третье" }] },
      { type: "paragraph", text: "Цена:\u00A0100\u00A0₽ и  ещё" },
    ]);
    expect(body.blocks[0]).not.toHaveProperty("start");
  });

  it("разметка за пределами текста (огромные номера строк) не принимается и не перебирается", () => {
    expect(marksValid(readLines("а\nб"), [{ kind: "p", from: 0, to: 1_000_000_000 }])).toBe(false);
  });

  it("хранимая разметка — та, по которой собраны блоки (с пустым пунктом «-»): при сохранении она снова ложится", () => {
    const parsed = parseArticle("- первое\n-\n- второе", null);
    expect(parsed.marks).toHaveLength(3);
    expect(parseArticle("- первое\n-\n- второе", parsed.marks)).toMatchObject({ byAi: true, body: { blocks: [{ type: "list", items: [{}, {}] }] } });
  });
});

describe("статья: фото и метки без нового разбора", () => {
  const { body } = parseArticle(WAFFLES, null);

  it("«Добавить фото сюда» — метка после блока; разметка переносится, фото на месте", () => {
    const after = lastLineOf(body, "b1");
    expect(after).toBe(1);
    const text = insertMarker(WAFFLES, after ?? -1, "ZZ22");
    expect(text.split("\n").slice(0, 5)).toEqual(["Вафли можно подать по-разному.", "Вот три любимых варианта 🧇", "", "[Фото ZZ22]", ""]);
    const moved = remap(WAFFLES, body, text);
    expect(moved.ok && moved.body.blocks.map((block) => block.type).slice(0, 3)).toEqual(["paragraph", "photo", "heading"]);
    expect(insertMarker("Один", -1, "AB34")).toBe("[Фото AB34]\n\nОдин");
  });

  it("перенос метки внутрь абзаца делит его на два; слова изменились — нужен новый разбор", () => {
    const text = WAFFLES.replace("[Фото Q7K2]\n", "").replace("творожным сыром,\n", "творожным сыром,\n[Фото Q7K2]\n");
    const moved = remap(WAFFLES, body, text);
    expect(moved.ok && moved.body.blocks.slice(2, 5).map((block) => (block.type === "paragraph" ? block.text : block.type))).toEqual([
      "Намажьте вафлю творожным сыром,",
      "photo",
      "сверху — ломтики слабосолёной рыбы.",
    ]);
    expect(remap(WAFFLES, body, WAFFLES.replace("ветчина", "бекон")).ok).toBe(false);
  });

  it("«Убрать фото» — строка-метка уходит вместе с лишней пустой строкой", () => {
    const text = removeMarker(WAFFLES, "Q7K2");
    expect(text).not.toContain("Q7K2");
    expect(text).not.toMatch(/\n\n\n/);
    const moved = remap(WAFFLES, body, text);
    expect(moved.ok && moved.body.blocks.filter((block) => block.type === "photo")).toHaveLength(1);
  });

  it("строки с текстом — без пустых и меток", () => {
    expect(contentLines(readLines("а\n\n[Фото Q7K2]\nб"))).toEqual([0, 3]);
  });
});

describe("статья: анонс и название", () => {
  it("анонс — первый абзац до 200 знаков по границе слова", () => {
    expect(excerptOf(parseArticle(WAFFLES, null).body)).toBe("Вафли можно подать по-разному. Вот три любимых варианта 🧇");
    const long = parseArticle(`${"слово ".repeat(60)}конец`, null).body;
    const excerpt = excerptOf(long) ?? "";
    expect(excerpt.length).toBeLessThanOrEqual(201);
    expect(excerpt.endsWith("слово…")).toBe(true);
  });

  it("название пишет владелец: пустое и длиннее 120 — нужно решить", () => {
    expect(titleIssue("  ")).toMatchObject({ group: "decide" });
    expect(titleIssue("В".repeat(121))).toMatchObject({ group: "decide" });
    expect(titleIssue("Вафли: варианты подачи")).toBeNull();
  });
});
