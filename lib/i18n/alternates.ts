import { LIVE_LOCALES, type Locale } from "@/i18n/routing";

type Alternates = { canonical: string; languages: Record<string, string> };

/**
 * canonical и hreflang страницы (ADR-0011: единственный источник, Link-заголовки next-intl выключены; ADR-0029:
 * адреса языков у рецепта и раздела разные). `paths` — адреса этой же страницы на языках, где она есть (рецепт без
 * перевода — только ru). x-default — только у главной: на `/` язык выберет proxy. Абсолютными URL делает metadataBase.
 */
export function pageAlternates(locale: Locale, paths: Partial<Record<Locale, string>>, home = false): Alternates {
  const languages: Record<string, string> = {};
  for (const item of LIVE_LOCALES) {
    const path = paths[item];
    if (path) languages[item] = path;
  }
  if (home && Object.keys(languages).length > 1) languages["x-default"] = "/";
  return { canonical: paths[locale] ?? `/${locale}`, languages };
}

/** Страница с одинаковым путём на всех живых языках (главная, поиск). */
export function samePathAlternates(locale: Locale, path: string): Alternates {
  const suffix = path === "/" ? "" : path;
  return pageAlternates(locale, Object.fromEntries(LIVE_LOCALES.map((item) => [item, `/${item}${suffix}`])), path === "/");
}
