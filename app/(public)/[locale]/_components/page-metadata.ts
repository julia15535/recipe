import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { localizedAlternates } from "@/lib/i18n/alternates";
import { getSiteConfig } from "@/lib/server/env";
import type { Locale } from "@/lib/server/recipes/public";

type Input = { locale: Locale; path: string; title?: string; description?: string | null; noindex?: boolean };

/**
 * Metadata публичной страницы: title, description, canonical, hreflang (только живые языки), Open Graph для
 * превью ссылок в мессенджерах. robots страницы заменяет robots layout целиком, поэтому пока сайт закрыт
 * (SITE_INDEXABLE ≠ true) — закрыто всё; после открытия noindex остаётся у поиска и пустых разделов.
 */
export async function pageMetadata({ locale, path, title, description, noindex = false }: Input): Promise<Metadata> {
  const t = await getTranslations("Meta");
  const { indexable } = getSiteConfig();
  const text = description ?? t("description");
  return {
    ...(title ? { title } : {}),
    description: text,
    alternates: localizedAlternates(locale, path),
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      locale: "ru_RU",
      url: `/${locale}${path === "/" ? "" : path}`,
      title: title ?? t("siteName"),
      description: text,
    },
    robots: indexable && !noindex ? { index: true, follow: true } : { index: false, follow: indexable },
  };
}
