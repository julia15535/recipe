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

// Вход владельца через Telegram-бота (план owner-login-telegram). TELEGRAM_API_BASE — только для
// заглушки Bot API в CI/e2e; в проде не задаётся.
const authSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d{5,20}:[A-Za-z0-9_-]{30,64}$/),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{3,30}bot$/i),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
  // Telegram: id пользователя — не больше 52 значащих бит.
  OWNER_TELEGRAM_ID: z
    .string()
    .regex(/^[1-9]\d{0,15}$/)
    .refine((value) => /^\d+$/.test(value) && BigInt(value) < 2n ** 52n),
  TELEGRAM_API_BASE: z.url().default("https://api.telegram.org"),
});
const AUTH_KEYS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME", "TELEGRAM_WEBHOOK_SECRET", "OWNER_TELEGRAM_ID"] as const;

export type SiteConfig = { siteUrl: string; indexable: boolean };
export type ServerEnv = z.infer<typeof serverSchema>;
export type AuthConfig = {
  botToken: string;
  botUsername: string;
  webhookSecret: string;
  ownerTelegramId: bigint;
  apiBase: string;
};

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

/**
 * Вход владельца. Ни одна из четырёх переменных не задана → вход выключен (null), сайт работает.
 * Задана часть или формат неверен → ошибка: это ошибка выкладки, а не «вход выключен».
 */
export function parseAuthEnv(source: Source): AuthConfig | null {
  if (AUTH_KEYS.every((key) => !source[key])) return null;
  const parsed = authSchema.safeParse(source);
  if (!parsed.success) fail("auth", parsed.error);
  return {
    botToken: parsed.data.TELEGRAM_BOT_TOKEN,
    botUsername: parsed.data.TELEGRAM_BOT_USERNAME,
    webhookSecret: parsed.data.TELEGRAM_WEBHOOK_SECRET,
    ownerTelegramId: BigInt(parsed.data.OWNER_TELEGRAM_ID),
    apiBase: parsed.data.TELEGRAM_API_BASE.replace(/\/+$/, ""),
  };
}
