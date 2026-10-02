import "server-only";
import { sql } from "drizzle-orm";

import type { Executor } from "@/lib/server/db/client";
import { log } from "@/lib/server/log";

// Уборка таблиц входа — не чаще раза в 10 минут на процесс и порциями: долгий DELETE не должен
// упереться в statement_timeout роли и сорвать вход. Сбой уборки вход не останавливает.
const EVERY_MS = 10 * 60 * 1000;
const BATCH = 1000;
let lastRun = 0;

export async function pruneExpired(db: Executor, now = Date.now()): Promise<void> {
  if (now - lastRun < EVERY_MS) return;
  lastRun = now;
  try {
    await db.execute(sql`delete from owner_login_challenges where id in (
      select id from owner_login_challenges where expires_at < now() - interval '1 day' limit ${BATCH})`);
    await db.execute(sql`delete from telegram_updates where update_id in (
      select update_id from telegram_updates where received_at < now() - interval '7 days' limit ${BATCH})`);
    await db.execute(sql`delete from owner_sessions where id in (
      select id from owner_sessions where expires_at < now() - interval '30 days'
        or revoked_at < now() - interval '30 days' limit ${BATCH})`);
  } catch (error) {
    log.warn("вход: уборка таблиц не удалась", { reason: error instanceof Error ? error.name : "unknown" });
  }
}
