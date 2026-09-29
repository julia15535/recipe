import "server-only";

import { type Mode, parseServerEnv, parseSiteConfig, type ServerEnv, type SiteConfig } from "./env-schema";

export type { ServerEnv, SiteConfig };

export function currentMode(): Mode {
  const mode = process.env.NODE_ENV;
  return mode === "production" || mode === "test" ? mode : "development";
}

let siteConfig: SiteConfig | undefined;
let serverEnv: ServerEnv | undefined;

export function getSiteConfig(): SiteConfig {
  siteConfig ??= parseSiteConfig(process.env, currentMode());
  return siteConfig;
}

export function getServerEnv(): ServerEnv {
  serverEnv ??= parseServerEnv(process.env, currentMode());
  return serverEnv;
}
