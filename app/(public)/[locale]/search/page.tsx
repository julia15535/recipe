import type { Metadata } from "next";
import { io } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { RecipeSearch } from "@/components/search/recipe-search";
import type { Locale } from "@/lib/server/recipes/public";
import { cachedCatalog, cachedSearchIndex } from "@/lib/server/recipes/public-cache";

import { toSearchEntries } from "../_components/cards";
import { otherLocale, pageLocale } from "../_components/page-locale";
import { pageMetadata } from "../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../_components/public-header";

// Поиск `/{locale}/search` (ADR-0017, решение владельца 01.10): ищет в браузере по компактному индексу опубликованных
// рецептов на языке страницы; состояние — в адресе. Всегда noindex. Кнопка языка ведёт на поиск без запроса:
// названия и ингредиенты на языках разные (ADR-0029).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await pageLocale();
  return pageMetadata({ locale, path: "/search", title: (await getTranslations("Search"))("title"), noindex: true });
}

export default async function SearchPage() {
  const locale = await pageLocale();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <SearchScreen locale={locale} />
    </Suspense>
  );
}

async function SearchScreen({ locale }: { locale: Locale }) {
  await io();
  const [catalog, index] = await Promise.all([cachedCatalog(locale), cachedSearchIndex(locale)]);
  return (
    <>
      <PublicHeader locale={locale} sections={catalog.sections} alternate={`/${otherLocale(locale)}/search`} />
      <RecipeSearch items={toSearchEntries(locale, index)} sections={catalog.sections} tags={catalog.tags} homeHref={`/${locale}`} />
    </>
  );
}
