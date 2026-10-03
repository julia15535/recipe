import { getTranslations } from "next-intl/server";

import type { CatalogSection } from "@/components/catalog/types";
import { SiteHeader } from "@/components/site-header";
import { type Locale, type PublicSection, sectionPath } from "@/lib/server/recipes/public";

// Шапка сайта из базы: 11 мест каталога; раздел без опубликованных рецептов — бледный и не ссылка (ADR-0020,
// владелец 02.10), открытый раздел — выделен. Данные шапки читает сама страница внутри своего <Suspense> — под
// границей ошибок (`error.tsx`), чтобы сбой базы давал «Попробовать снова», а не пустой каталог.
// `alternate` — эта же страница на другом языке (кнопка RU/EN, ADR-0029): у рецепта без перевода — главная.
type Props = { locale: Locale; sections: PublicSection[]; current?: string; alternate: string };

export async function PublicHeader({ locale, sections, current, alternate }: Props) {
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
      signature={{ text: site("signature"), locale }}
      homeHref={`/${locale}`}
      searchHref={`/${locale}/search`}
      searchLabel={site("search")}
      catalog={{ sections: catalog, label: site("catalog"), closeLabel: site("close") }}
      language={{ href: alternate, label: site("otherLanguage.label"), name: site("otherLanguage.name"), lang: site("otherLanguage.lang") }}
    />
  );
}

/** Пока данные шапки грузятся (редко: они в кэше) — место той же высоты, без сдвига страницы. */
export function HeaderFallback() {
  return <div aria-hidden className="h-(--site-header-height) border-b border-secondary bg-page" />;
}
