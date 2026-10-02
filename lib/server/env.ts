import "server-only";

import {
  type AuthConfig,
  type Mode,
  parseAuthEnv,
  parseServerEnv,
  parseSiteConfig,
  type ServerEnv,
  type SiteConfig,
} from "./env-schema";

export type { AuthConfig, ServerEnv, SiteConfig };

export function currentMode(): Mode {
  const mode = process.env.NODE_ENV;
  return mode === "production" || mode === "test" ? mode : "development";
}

let siteConfig: SiteConfig | undefined;
let serverEnv: ServerEnv | undefined;
let authConfig: AuthConfig | null | undefined;

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
