// Прод-мигратор (ADR-0012). В образе standalone нет drizzle-kit, поэтому миграции применяет этот
// скрипт на drizzle-orm migrator. В образе он лежит собранным в один файл (migrator/migrate.mjs).
//
// Запуск: MIGRATION_DATABASE_URL=... node scripts/migrate.mjs
// Логин recipe_migrator → SET ROLE recipe_owner: все объекты принадлежат владельцу схемы.
// У Drizzle нет встроенной блокировки, поэтому держим session advisory lock на единственном
// соединении пула (max: 1) — два параллельных запуска не применят миграции дважды.
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const LOCK_KEY = "recipe:migrate";
const LOCK_DEADLINE_MS = Number(process.env.MIGRATE_LOCK_TIMEOUT_MS ?? 120_000);
const url = process.env.MIGRATION_DATABASE_URL;
const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

function out(level, msg, fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

if (!url) {
  out("error", "MIGRATION_DATABASE_URL не задан");
  process.exit(2);
}

const sql = postgres(url, {
  max: 1,
  connect_timeout: 10,
  onnotice: () => {},
  connection: { application_name: "recipe-migrate" },
});

async function acquireLock() {
  const deadline = Date.now() + LOCK_DEADLINE_MS;
  for (;;) {
    const [row] = await sql`select pg_try_advisory_lock(hashtext(${LOCK_KEY})) as ok`;
    if (row?.ok) return;
    if (Date.now() > deadline) throw new Error(`не дождались блокировки миграций за ${LOCK_DEADLINE_MS} мс`);
    out("info", "миграции уже идут в другом процессе — ждём");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

let code = 0;
try {
  await sql`set role recipe_owner`;
  await acquireLock();
  try {
    const started = Date.now();
    await migrate(drizzle(sql), { migrationsFolder });
    const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    out("info", "миграции применены", { applied: row?.n ?? 0, ms: Date.now() - started });
  } finally {
    await sql`select pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
  }
} catch (error) {
  out("error", "миграции не применены", { error: error instanceof Error ? error.message : String(error) });
  code = 1;
} finally {
  await sql.end({ timeout: 5 });
}
process.exit(code);
