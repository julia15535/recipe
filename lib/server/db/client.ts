import "server-only";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/lib/server/env";

import * as schema from "./schema";

// ADR-0012: рантайм ходит в БД ролью recipe_app (только DML); таймауты запросов заданы на роль,
// здесь — лимиты пула. Один пул на процесс (в dev переживает HMR через globalThis).
type Sql = ReturnType<typeof postgres>;
const globalForDb = globalThis as typeof globalThis & { recipeSql?: Sql };

export function getSql(): Sql {
  globalForDb.recipeSql ??= postgres(getServerEnv().DATABASE_URL, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    connection: { application_name: "recipe-web" },
    onnotice: () => {},
  });
  return globalForDb.recipeSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

/** База или открытая транзакция — функции доступа к данным принимают любое из двух. */
export type Executor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/** `select 1` с жёстким таймаутом — для /api/health/ready. */
export async function pingDb(timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const query = getSql()`select 1 as ok`.then(() => true).catch(() => false);
  try {
    return await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
