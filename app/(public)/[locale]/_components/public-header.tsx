import { getTranslations } from "next-intl/server";

import type { CatalogSection } from "@/components/catalog/types";
import { SiteHeader } from "@/components/site-header";
import { type Locale, type PublicSection, sectionPath } from "@/lib/server/recipes/public";

// Шапка сайта из базы: 11 мест каталога; раздел без опубликованных рецептов — бледный и не ссылка (ADR-0020,
// владелец 02.10), открытый раздел — выделен. Данные шапки читает сама страница внутри своего <Suspense> — под
// границей ошибок (`error.tsx`), чтобы сбой базы давал «Попробовать снова», а не пустой каталог.
type Props = { locale: Locale; sections: PublicSection[]; current?: string };

export async function PublicHeader({ locale, sections, current }: Props) {
  const [meta, site] = await Promise.all([getTranslations("Meta"), getTranslations("Site")]);
  const catalog: CatalogSection[] = sections.map((section) => ({
    id: section.code,
    label: section.label,
    href: sectionPath(locale, section.slug),
    empty: section.recipes === 0,
    current: section.code === current,
  }));
  return (
    <SiteHeader
      siteName={meta("siteName")}
      homeHref={`/${locale}`}
      searchHref={`/${locale}/search`}
      searchLabel={site("search")}
      catalog={{ sections: catalog, label: site("catalog"), closeLabel: site("close") }}
    />
  );
}

/** Пока данные шапки грузятся (редко: они в кэше) — место той же высоты, без сдвига страницы. */
export function HeaderFallback() {
  return <div aria-hidden className="h-(--site-header-height) border-b border-secondary bg-page" />;
}
