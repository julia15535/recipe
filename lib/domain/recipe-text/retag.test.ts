import { describe, expect, it } from "vitest";

import { orderTags, retagText, withoutCatalogLines } from "./retag";

const labels = {
  sections: new Map([
    ["hot", "Горячее"],
    ["breakfast", "Завтраки"],
  ]),
  tags: new Map([
    ["protein", "Белок"],
    ["omega-3", "Омега-3"],
    ["antioxidants", "Антиоксиданты"],
  ]),
};
const BODY = "Ингредиенты:\n- Лосось — 600 г - основной\n- Соль — по вкусу\n\nПриготовление:\n1. Запечь 20 минут.\n2. Теги: это не строка каталога, а шаг.";

describe("строка тегов в тексте рецепта", () => {
  it("первая строка каталога → «Теги: разделы, теги», остальное — байт в байт (и последний перевод строки)", () => {
    const source = `Лосось в духовке\nОписание: Быстро.\nТеги: горячее, белок, острое\n\n${BODY}\n`;
    const result = retagText(source, ["protein", "omega-3"], labels);
    expect(result).toEqual({ ok: true, text: source.replace("Теги: горячее, белок, острое", "Теги: горячее, белок, омега-3") });
  });

  it("«Раздел:» и «Тег:» отдельными строками — в одну строку; строка «Теги:» в шагах не трогается", () => {
    const source = `Лосось\nРаздел: горячее\nТег: белок\n${BODY}`;
    const result = retagText(source, ["omega-3"], labels);
    expect(result).toEqual({ ok: true, text: `Лосось\nТеги: горячее, омега-3\n${BODY}` });
  });

  it("CRLF сохраняется; ноль тегов — в строке только разделы", () => {
    const source = `Лосось\r\nКатегория: горячее\r\nТег: белок\r\n${BODY.replaceAll("\n", "\r\n")}`;
    expect(retagText(source, [], labels)).toEqual({ ok: true, text: `Лосось\r\nТеги: горячее\r\n${BODY.replaceAll("\n", "\r\n")}` });
  });

  it("отказ: пустой текст, нет строки каталога, неизвестный код тега", () => {
    expect(retagText("", ["protein"], labels)).toEqual({ ok: false });
    expect(retagText(`Лосось\n${BODY}`, ["protein"], labels)).toEqual({ ok: false });
    expect(retagText(`Лосось\nТеги: горячее\n${BODY}`, ["iron"], labels)).toEqual({ ok: false });
  });

  it("вход ИИ-подбора — без строк каталога (и без «Разделы:»), шаг с «Теги:» на месте", () => {
    const source = `Лосось\nРазделы: горячее\nТеги: белок, омега-3\n${BODY}\n`;
    expect(withoutCatalogLines(source)).toBe(`Лосось\n${BODY}\n`);
  });

  it("порядок записи: оставшиеся — как у автора, новые — в конец по каталогу", () => {
    expect(orderTags(["iron", "protein"], ["antioxidants", "protein", "omega-3", "iron"])).toEqual(["iron", "protein", "omega-3", "antioxidants"]);
    expect(orderTags(["protein"], [])).toEqual([]);
  });
});
