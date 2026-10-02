import type { Metadata } from "next";

import { LIVE_LOCALES } from "@/i18n/routing";

/**
 * canonical и hreflang страницы (ADR-0011: единственный источник, Link-заголовки next-intl выключены).
 * path — путь без префикса локали ("/" для главной). Абсолютными URL делает metadataBase из SITE_URL.
 * hreflang — только языки, где сайт уже есть (LIVE_LOCALES); x-default — когда их больше одного.
 */
export function localizedAlternates(locale: string, path: string): NonNullable<Metadata["alternates"]> {
  const suffix = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const item of LIVE_LOCALES) languages[item] = `/${item}${suffix}`;
  if (LIVE_LOCALES.length > 1) languages["x-default"] = suffix || "/";
  return { canonical: `/${locale}${suffix}`, languages };
}
