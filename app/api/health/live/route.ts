import { connection } from "next/server";

// Liveness: процесс жив. БД не трогаем — её недоступность не повод перезапускать контейнер.
export async function GET() {
  await connection();
  return Response.json({ ok: true, version: process.env.GIT_SHA ?? "dev" }, { headers: { "cache-control": "no-store" } });
}
