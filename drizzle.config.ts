import { defineConfig } from "drizzle-kit";

// drizzle-kit не читает .env.local сам — URL берём из окружения или локального дефолта (docker-compose).
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/server/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    url:
      process.env.MIGRATION_DATABASE_URL ?? "postgres://recipe_migrator:recipe_migrator_dev@127.0.0.1:5434/recipe",
  },
});
