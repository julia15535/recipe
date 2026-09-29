import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/**
 * canonical и hreflang страницы (ADR-0011: единственный источник, Link-заголовки next-intl выключены).
 * path — путь без префикса локали ("/" для главной). Абсолютными URL делает metadataBase из SITE_URL.
 * x-default ведёт на путь без локали: proxy сам выберет язык посетителя.
 */
export function localizedAlternates(locale: string, path: string): NonNullable<Metadata["alternates"]> {
  const suffix = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const item of routing.locales) languages[item] = `/${item}${suffix}`;
  languages["x-default"] = suffix || "/";
  return { canonical: `/${locale}${suffix}`, languages };
}
