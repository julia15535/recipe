// Разбор env без `server-only`: его импортируют и геттеры (lib/server/env.ts), и проверка
// при старте сервера (instrumentation.ts), и тесты.
import { z } from "zod";

export type Mode = "production" | "development" | "test";
export type Source = Record<string, string | undefined>;

// Дефолты только для разработки и тестов — совпадают с docker-compose.yml и .env.example.
const DEV_DEFAULTS = {
  SITE_URL: "http://localhost:3010",
  DATABASE_URL: "postgres://recipe_app:recipe_app_dev@127.0.0.1:5434/recipe",
  GIT_SHA: "dev",
} as const;

const siteSchema = z.object({
  SITE_URL: z.url(),
  SITE_INDEXABLE: z.enum(["true", "false"]).default("false"),
});

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  GIT_SHA: z.string().min(1),
});

export type SiteConfig = { siteUrl: string; indexable: boolean };
export type ServerEnv = z.infer<typeof serverSchema>;

function withDevDefaults(source: Source, mode: Mode, keys: readonly (keyof typeof DEV_DEFAULTS)[]): Source {
  if (mode === "production") return source;
  const merged: Source = { ...source };
  for (const key of keys) merged[key] ??= DEV_DEFAULTS[key];
  return merged;
}

function fail(scope: string, error: z.ZodError): never {
  const fields = error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
  throw new Error(`[env] ${scope}: отсутствуют или неверны переменные окружения: ${fields}`);
}

/** Публичная конфигурация сайта. В production обязательна уже на этапе сборки (запекается в HTML). */
export function parseSiteConfig(source: Source, mode: Mode): SiteConfig {
  const parsed = siteSchema.safeParse(withDevDefaults(source, mode, ["SITE_URL"]));
  if (!parsed.success) fail("site", parsed.error);
  return {
    siteUrl: parsed.data.SITE_URL.replace(/\/+$/, ""),
    indexable: parsed.data.SITE_INDEXABLE === "true",
  };
}

/** Секреты рантайма. Читаются лениво — сборка образа их не требует. */
export function parseServerEnv(source: Source, mode: Mode): ServerEnv {
  const parsed = serverSchema.safeParse(withDevDefaults(source, mode, ["DATABASE_URL", "GIT_SHA"]));
  if (!parsed.success) fail("server", parsed.error);
  return parsed.data;
}
