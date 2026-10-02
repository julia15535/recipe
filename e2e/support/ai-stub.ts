import http from "node:http";
import { readFileSync } from "node:fs";

// Заглушка Vercel AI Gateway для e2e: на «Разобрать» отвечает готовым разбором котлет (название — первая
// фраза присланного текста), на «СБОЙ-ИИ» — 500, на «НЕ-РЕЦЕПТ» — not_recipe. GET /__ai-calls — сколько
// было запросов (двойной клик должен дать один).
export const AI_STUB_PORT = Number(process.env.E2E_AI_STUB_PORT ?? 3998);
const kotlety = JSON.parse(readFileSync("lib/domain/recipe-text/fixtures/ai-kotlety.json", "utf8")) as Record<string, unknown>;

export function startAiStub(): Promise<() => Promise<void>> {
  let calls = 0;
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/__ai-calls") {
      res.end(JSON.stringify({ calls }));
      return;
    }
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    req.on("end", () => {
      calls += 1;
      const request = JSON.parse(body || "{}") as { messages?: { content: string }[] };
      const text = request.messages?.[1]?.content ?? "";
      if (text.includes("СБОЙ-ИИ")) {
        res.statusCode = 500;
        res.end("{}");
        return;
      }
      const title = (text.split(/[.\n]/)[0] ?? "").trim();
      const recipe = text.includes("НЕ-РЕЦЕПТ")
        ? { ...kotlety, result_type: "not_recipe", title: "", sections: [], tags: [], ingredients: [], steps: [], tips: [], changes: [], doubts: [] }
        : { ...kotlety, title, tips: ["Фарш лучше брать охлаждённый."] };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(recipe) }, finish_reason: "stop" }], usage: { cost: 0 } }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(AI_STUB_PORT, "127.0.0.1", () => resolve(() => new Promise<void>((done) => server.close(() => done()))));
  });
}
