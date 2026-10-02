import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";

import { RecipeSearch } from "@/components/search/recipe-search";
import { cachedCatalog, cachedSearchIndex } from "@/lib/server/recipes/public-cache";

import { toSearchEntries } from "../_components/cards";
import { pageMetadata } from "../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../_components/public-header";

// Поиск `/ru/search` (ADR-0017, решение владельца 01.10): ищет в браузере по компактному индексу опубликованных
// рецептов; состояние — в адресе. Всегда noindex (результаты — не страница для поисковиков), canonical — без запроса.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale !== "ru") return {};
  return pageMetadata({ locale, path: "/search", title: "Поиск", noindex: true });
}

export default async function SearchPage() {
  if ((await getLocale()) !== "ru") notFound();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <SearchScreen />
    </Suspense>
  );
}

async function SearchScreen() {
  await io();
  const [catalog, index] = await Promise.all([cachedCatalog("ru"), cachedSearchIndex("ru")]);
  return (
    <>
      <PublicHeader locale="ru" sections={catalog.sections} />
      <RecipeSearch items={toSearchEntries("ru", index)} sections={catalog.sections} tags={catalog.tags} homeHref="/ru" />
    </>
  );
}
