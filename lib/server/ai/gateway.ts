import "server-only";

import type { AiConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";

// Клиент Vercel AI Gateway (OpenAI Chat Completions, json_schema strict) на fetch, без SDK. Без скрытых
// повторов: запрос мог уже стоить денег — повторяет владелец кнопкой. В лог — только служебные числа.
export type AiFailure = "network" | "timeout" | "auth" | "rate" | "server" | "bad-response" | "refusal" | "length";
export type AiResult = { ok: true; json: unknown } | { ok: false; reason: AiFailure };

type Request = { system: string; user: string; schemaName: string; schema: object; maxTokens: number; timeoutMs: number; label?: string };
type Completion = {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
};

export async function chatJson(config: AiConfig, request: Request): Promise<AiResult> {
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        response_format: { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
        max_completion_tokens: request.maxTokens,
        ...(config.model.startsWith("openai/gpt-") ? { reasoning_effort: "low" } : {}),
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const reason: AiFailure = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";
    log.warn("ии: шлюз недоступен", { reason, ms: Date.now() - started, model: config.model });
    return { ok: false, reason };
  }
  const meta = { status: response.status, ms: Date.now() - started, model: config.model, task: request.label, inputBytes: Buffer.byteLength(request.user) };
  if (!response.ok) {
    log.warn("ии: шлюз отказал", meta);
    const reason: AiFailure =
      response.status === 401 || response.status === 403 ? "auth" : response.status === 429 ? "rate" : response.status >= 500 ? "server" : "bad-response";
    return { ok: false, reason };
  }
  const body = (await response.json().catch(() => null)) as Completion | null;
  const choice = body?.choices?.[0];
  log.info("ии: разбор", { ...meta, inTok: body?.usage?.prompt_tokens, outTok: body?.usage?.completion_tokens, cost: body?.usage?.cost });
  if (!choice) return { ok: false, reason: "bad-response" };
  if (choice.message?.refusal) return { ok: false, reason: "refusal" };
  if (choice.finish_reason === "length") return { ok: false, reason: "length" };
  try {
    return { ok: true, json: JSON.parse(choice.message?.content ?? "") as unknown };
  } catch {
    return { ok: false, reason: "bad-response" };
  }
}
