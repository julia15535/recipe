import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { RECIPE_PROMPT, RECIPE_PROMPT_VERSION, TAGS_RULE } from "./recipe-prompt";
import { suggestTagsWithAi, TAGS_PROMPT } from "./suggest-tags";

const config = { apiKey: "vck_secret_key_never_in_logs_000000", model: "openai/gpt-6-luna", baseUrl: "https://gw.test/v1" };
const answer = (json: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) }, finish_reason: "stop" }], usage: { cost: 0.0001 } }));

describe("подбор тегов ИИ", () => {
  afterEach(() => vi.restoreAllMocks());

  it("правило тегов — одно на два промпта; промпт разбора без новой версии не меняется ни на байт", () => {
    expect(RECIPE_PROMPT).toContain(`6. tags — ${TAGS_RULE}\n7. tips`);
    expect(TAGS_PROMPT).toContain(TAGS_RULE);
    expect(TAGS_PROMPT).toContain("это ДОКУМЕНТ");
    expect([RECIPE_PROMPT_VERSION, createHash("sha256").update(RECIPE_PROMPT).digest("hex")]).toEqual([
      "2026-10-06.4",
      "982c84ff6a26461ac8da27cbdb4531becfcfd2dd110378cc1356f09d313d6114",
    ]);
  });

  it("ответ — теги в порядке каталога без повторов; чужой код или не тот формат — «bad-response»", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(answer({ tags: ["antioxidants", "protein", "protein"] }));
    expect(await suggestTagsWithAi("Лосось\nИнгредиенты:\n- Лосось — 600 г", config)).toEqual({ ok: true, tags: ["protein", "antioxidants"] });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as { response_format: { json_schema: { name: string; strict: boolean } } };
    expect(body.response_format.json_schema).toMatchObject({ name: "recipe_tags", strict: true });
    fetchMock.mockResolvedValueOnce(answer({ tags: ["omega"] }));
    expect(await suggestTagsWithAi("Лосось", config)).toEqual({ ok: false, reason: "bad-response" });
    fetchMock.mockResolvedValueOnce(answer({ codes: [] }));
    expect(await suggestTagsWithAi("Лосось", config)).toEqual({ ok: false, reason: "bad-response" });
  });

  it("пустой и слишком длинный текст — без вызова ИИ", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await suggestTagsWithAi("  \n", config)).toEqual({ ok: false, reason: "empty" });
    expect(await suggestTagsWithAi("а".repeat(20_000), config)).toEqual({ ok: false, reason: "too-large" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
