import { connection } from "next/server";

import { pingDb } from "@/lib/server/db/client";
import { getServerEnv } from "@/lib/server/env";
import { log } from "@/lib/server/log";

// Readiness: БД отвечает за 2 с; version — коммит образа. По нему деплой сверяет, что в проде
// именно нужный релиз (ADR-0014).
export async function GET() {
  await connection();
  const { GIT_SHA } = getServerEnv();
  const db = await pingDb(2000);
  if (!db) log.warn("ready: БД недоступна");
  return Response.json(
    { ok: db, db, version: GIT_SHA },
    { status: db ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
