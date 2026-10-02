import { afterEach, describe, expect, it, vi } from "vitest";

import { chatJson } from "./gateway";

const config = { apiKey: "vck_secret_key_never_in_logs_000000", model: "openai/gpt-6-luna", baseUrl: "https://gw.test/v1" };
const request = { system: "s", user: "Секретный рецепт бабушки", schemaName: "recipe", schema: {}, maxTokens: 100, timeoutMs: 1000 };
const answer = (content: string | null, extra: object = {}) =>
  new Response(JSON.stringify({ choices: [{ message: { content, ...extra }, finish_reason: "stop" }], usage: { cost: 0.0001 } }));

function captureLogs(): () => string {
  const lines: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (lines.push(String(chunk)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (lines.push(String(chunk)), true));
  return () => lines.join("");
}

describe("клиент шлюза ИИ", () => {
  afterEach(() => vi.restoreAllMocks());

  it("успех: JSON из ответа; в лог — только служебные числа, без ключа и текста", async () => {
    const logs = captureLogs();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(answer('{"ok":1}'));
    expect(await chatJson(config, request)).toEqual({ ok: true, json: { ok: 1 } });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as { response_format: { json_schema: { strict: boolean } }; reasoning_effort: string };
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.reasoning_effort).toBe("low");
    expect(logs()).not.toContain("vck_secret");
    expect(logs()).not.toContain("Секретный рецепт");
  });

  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate"],
    [500, "server"],
    [400, "bad-response"],
  ])("HTTP %i → %s", async (status, reason) => {
    captureLogs();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>oops</html>", { status }));
    expect(await chatJson(config, request)).toEqual({ ok: false, reason });
  });

  it("таймаут, сеть, HTML вместо JSON, кривой JSON, отказ модели, обрыв по длине", async () => {
    captureLogs();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    expect(await chatJson(config, request)).toEqual({ ok: false, reason: "timeout" });
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await chatJson(config, request)).toEqual({ ok: false, reason: "network" });
    fetchMock.mockResolvedValueOnce(new Response("<html>gateway</html>"));
    expect(await chatJson(config, request)).toEqual({ ok: false, reason: "bad-response" });
    fetchMock.mockResolvedValueOnce(answer("{не json"));
    expect(await chatJson(config, request)).toEqual({ ok: false, reason: "bad-response" });
    fetchMock.mockResolvedValueOnce(answer(null, { refusal: "не могу" }));
    expect(await chatJson(config, request)).toEqual({ ok: false, reason: "refusal" });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"a"' }, finish_reason: "length" }] })),
    );
    expect(await chatJson(config, request)).toEqual({ ok: false, reason: "length" });
  });
});
