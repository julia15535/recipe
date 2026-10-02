import "server-only";

import {
  type AiConfig,
  type AuthConfig,
  type Mode,
  parseAiEnv,
  parseAuthEnv,
  parseServerEnv,
  parseSiteConfig,
  type ServerEnv,
  type SiteConfig,
} from "./env-schema";

export type { AiConfig, AuthConfig, ServerEnv, SiteConfig };

export function currentMode(): Mode {
  const mode = process.env.NODE_ENV;
  return mode === "production" || mode === "test" ? mode : "development";
}

let siteConfig: SiteConfig | undefined;
let serverEnv: ServerEnv | undefined;
let authConfig: AuthConfig | null | undefined;
let aiConfig: AiConfig | null | undefined;

export function getSiteConfig(): SiteConfig {
  siteConfig ??= parseSiteConfig(process.env, currentMode());
  return siteConfig;
}

export function getServerEnv(): ServerEnv {
  serverEnv ??= parseServerEnv(process.env, currentMode());
  return serverEnv;
}

/** Настройки входа владельца; null — вход не настроен (переменные не заданы). */
export function getAuthConfig(): AuthConfig | null {
  if (authConfig === undefined) authConfig = parseAuthEnv(process.env);
  return authConfig;
}

/** Настройки ИИ-разбора; null — ключа нет, разбор только «по старому формату». */
export function getAiConfig(): AiConfig | null {
  if (aiConfig === undefined) aiConfig = parseAiEnv(process.env);
  return aiConfig;
}
