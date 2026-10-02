import { afterEach, describe, expect, it, vi } from "vitest";

import aiVafli from "@/lib/domain/recipe-text/fixtures/ai-vafli.json";

import { parseWithAi } from "./parse-recipe";

const config = { apiKey: "vck_fake_key_for_tests_0000000000", model: "openai/gpt-6-luna", baseUrl: "https://gw.test/v1" };
const labels = { sections: new Map(), tags: new Map() };
const reply = (json: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) }, finish_reason: "stop" }] }));

describe("ИИ-разбор: до и после шлюза", () => {
  afterEach(() => vi.restoreAllMocks());

  it("пустой и слишком большой текст — без вызова шлюза", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await parseWithAi("   ", config, labels)).toEqual({ ok: false, reason: "empty" });
    expect(await parseWithAi("🍰".repeat(5121), config, labels)).toEqual({ ok: false, reason: "too-large" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ответ не по схеме (лишнее, не тот раздел) — «ответил непонятно», не падение", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ ...aiVafli, sections: ["pizza"] }));
    expect(await parseWithAi("Вафли", config, labels)).toEqual({ ok: false, reason: "bad-response" });
  });

  it("ответ по схеме → черновик и «Проверьте»", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ ...aiVafli, changes: [] }));
    const result = await parseWithAi("Творожные вафли", config, labels);
    expect(result.ok && result.result.draft.title).toBe("Творожные вафли");
  });
});
