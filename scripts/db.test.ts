// Интеграционные проверки БД: роли и мигратор. Нужна живая база (pnpm db:up) —
// запускаются через `pnpm test:db` (RECIPE_DB_TESTS=1), в обычном `pnpm test` пропускаются.
import { spawn } from "node:child_process";

import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { TAG_CODES } from "@/lib/domain/catalog";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const appUrl = process.env.DATABASE_URL ?? "postgres://recipe_app:recipe_app_dev@127.0.0.1:5434/recipe";
const migratorUrl =
  process.env.MIGRATION_DATABASE_URL ?? "postgres://recipe_migrator:recipe_migrator_dev@127.0.0.1:5434/recipe";
const migrateCommand = (process.env.MIGRATE_COMMAND ?? "node scripts/migrate.mjs").split(" ");

function runMigrate(): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = migrateCommand;
    const child = spawn(cmd ?? "node", args, { env: { ...process.env, MIGRATION_DATABASE_URL: migratorUrl } });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code, output }));
  });
}

describe.skipIf(!enabled)("БД: роли и мигратор", () => {
  const app = postgres(appUrl, { max: 1, onnotice: () => {} });
  afterAll(() => app.end({ timeout: 5 }));

  it("два параллельных запуска мигратора завершаются успешно", async () => {
    const [first, second] = await Promise.all([runMigrate(), runMigrate()]);
    expect(first.code, first.output).toBe(0);
    expect(second.code, second.output).toBe(0);
  }, 60_000);

  it("повторный запуск не меняет журнал миграций", async () => {
    const owner = postgres(migratorUrl, { max: 1, onnotice: () => {} });
    const count = async () => (await owner`select count(*)::int as n from drizzle.__drizzle_migrations`)[0]?.n;
    const before = await count();
    expect((await runMigrate()).code).toBe(0);
    expect(await count()).toBe(before);
    await owner.end({ timeout: 5 });
  }, 60_000);

  it("теги состава после миграций: те же семь кодов, что в коде, в порядке фильтра; у каждого подписи ru и en", async () => {
    const rows = await app<{ code: string; id: string; ru: string; en: string }[]>`
      select t.code, t.id::text as id,
        max(l.label) filter (where l.locale = 'ru') as ru,
        max(l.label) filter (where l.locale = 'en') as en
      from composition_tags t join composition_tag_localizations l on l.tag_id = t.id
      group by t.id, t.code, t.position order by t.position`;
    expect(rows.map((row) => row.code)).toEqual([...TAG_CODES]);
    expect(rows.find((row) => row.code === "omega-3")).toEqual({ code: "omega-3", id: "d7f2c44c-a0e4-4f09-8333-43cc7376d713", ru: "Омега-3", en: "Omega-3" });
    expect(rows.find((row) => row.code === "antioxidants")).toEqual({ code: "antioxidants", id: "092046fc-4b5f-4705-bebe-2165cc3bb061", ru: "Антиоксиданты", en: "Antioxidants" });
    expect(rows.find((row) => row.code === "fiber")?.en).toBe("Fiber");
    expect(rows.every((row) => row.ru && row.en)).toBe(true);
  });

  it("роль рантайма не может менять схему", async () => {
    await expect(app`create table recipe_app_ddl_probe (id int)`).rejects.toThrow(/permission denied/);
  });

  it("роль рантайма не видит журнал миграций", async () => {
    await expect(app`select 1 from drizzle.__drizzle_migrations limit 1`).rejects.toThrow(/permission denied/);
  });
});
