import http from "node:http";

import { startAiStub } from "./support/ai-stub";
import { TELEGRAM } from "./support/telegram";

// Заглушка Bot API для e2e: сайт шлёт ответы бота сюда (TELEGRAM_API_BASE), тесты читают их через
// GET /__calls — как владелец видит сообщение бота с кодом и кнопками. Сеть и настоящий бот не нужны.
export default async function globalSetup() {
  if (!TELEGRAM.enabled) return;
  const stopAi = await startAiStub();
  const calls: { method: string; params: unknown }[] = [];
  let messageId = 100;
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/__calls") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(calls));
      return;
    }
    const method = /^\/bot[^/]+\/(\w+)$/.exec(req.url ?? "")?.[1];
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    req.on("end", () => {
      if (!method) {
        res.statusCode = 404;
        res.end();
        return;
      }
      calls.push({ method, params: JSON.parse(body || "{}") as unknown });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, result: method === "sendMessage" ? { message_id: (messageId += 1) } : true }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(TELEGRAM.stubPort, "127.0.0.1", resolve);
  });
  return async () => {
    await stopAi();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
