import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeText } from "@/lib/domain/article-text/lines";
import { parseArticle } from "@/lib/domain/article-text/parse";
import { articleUnits } from "@/lib/domain/article-text/translation";
import { maskNumbers, unmaskNumbers } from "@/lib/domain/translation-numbers";

import { translateArticleWithAi } from "./translate-article";

const config = { apiKey: "vck_secret_key_never_in_logs_000000", model: "openai/gpt-6-luna", baseUrl: "https://gw.test/v1" };
const answer = (json: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) }, finish_reason: "stop" }], usage: { cost: 0 } }));
const text = normalizeText("Пеките **25 минут** при 180 °C.\n\n# Подача\n- с мёдом");
const source = { title: "Вафли", body: parseArticle(text, null).body, captions: {} };
// Ответ «как у ИИ»: переведённые тексты с теми же метками чисел и оформления.
const good = () => articleUnits(source).map((unit) => ({ id: unit.id, text: `EN ${maskNumbers(unit.text).text}` }));

describe("перевод статьи: проверка ответа ИИ", () => {
  afterEach(() => vi.restoreAllMocks());

  it("годный ответ → статья той же структуры, числа и оформление на месте", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(answer({ items: good() }));
    const result = await translateArticleWithAi(source, config);
    expect(result.ok && result.article.body.blocks[0]).toMatchObject({ type: "paragraph", text: "EN Пеките **25 минут** при 180 °C." });
  });

  it("отказ: id не по порядку — structure; потерянное число — numbers; Фаренгейт — numbers; не тот формат — bad-response", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const items = good();
    fetchMock.mockResolvedValueOnce(answer({ items: [items[1], items[0], ...items.slice(2)] }));
    expect(await translateArticleWithAi(source, config)).toEqual({ ok: false, reason: "structure" });
    fetchMock.mockResolvedValueOnce(answer({ items: items.map((item) => ({ ...item, text: item.text.replace("⟦1⟧", "twenty-five") })) }));
    expect(await translateArticleWithAi(source, config)).toEqual({ ok: false, reason: "numbers" });
    fetchMock.mockResolvedValueOnce(answer({ items: items.map((item) => ({ ...item, text: item.text.replace("°C", "°C (350 °F)") })) }));
    expect(await translateArticleWithAi(source, config)).toEqual({ ok: false, reason: "numbers" });
    fetchMock.mockResolvedValueOnce(answer({ rows: [] }));
    expect(await translateArticleWithAi(source, config)).toEqual({ ok: false, reason: "bad-response" });
  });

  it("свои цифры в статье можно («три» → «3»), в рецепте — нет; ° и % проверяются всё равно", () => {
    expect(unmaskNumbers("3 ways", [], "en", "три варианта", true)).toBe("3 ways");
    expect(unmaskNumbers("3 ways", [], "en", "три варианта")).toBeNull();
    expect(unmaskNumbers("at ⟦1⟧ degrees", ["180"], "en", "при ⟦1⟧ °C", true)).toBeNull();
  });
});
