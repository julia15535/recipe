import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { OG } from "@/lib/domain/photo";
import { pageAlternates, samePathAlternates } from "@/lib/i18n/alternates";
import { getSiteConfig } from "@/lib/server/env";
import type { Locale } from "@/lib/server/recipes/public";

/** `path` — у страниц с одинаковым путём на языках (главная, поиск); `paths` — адреса языков (рецепт, раздел). */
type Input = {
  locale: Locale;
  path?: string;
  paths?: Partial<Record<Locale, string>>;
  title?: string;
  description?: string | null;
  noindex?: boolean;
  image?: string | null;
};

/**
 * Metadata публичной страницы: title, description, canonical, hreflang (только живые языки), Open Graph для
 * превью ссылок в мессенджерах. robots страницы заменяет robots layout целиком, поэтому пока сайт закрыт
 * (SITE_INDEXABLE ≠ true) — закрыто всё; после открытия noindex остаётся у поиска и пустых разделов.
 */
export async function pageMetadata({ locale, path = "/", paths, title, description, noindex = false, image = null }: Input): Promise<Metadata> {
  const t = await getTranslations("Meta");
  const { indexable } = getSiteConfig();
  const text = description ?? t("description");
  const alternates = paths ? pageAlternates(locale, paths) : samePathAlternates(locale, path);
  return {
    ...(title ? { title } : {}),
    description: text,
    alternates,
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      locale: locale === "en" ? "en_GB" : "ru_RU",
      url: alternates.canonical,
      title: title ?? t("siteName"),
      description: text,
      // Превью ссылки — кадр владельца 1200×630 (ADR-0028); путь абсолютным делает metadataBase.
      ...(image ? { images: [{ url: image, width: OG.width, height: OG.height, alt: title ?? t("siteName") }] } : {}),
    },
    robots: indexable && !noindex ? { index: true, follow: true } : { index: false, follow: indexable },
  };
}
