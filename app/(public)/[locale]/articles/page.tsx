import type { Metadata } from "next";
import { io } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ArticleGrid } from "@/components/article/article-card";
import { articlePath } from "@/lib/server/articles/public";
import type { Locale } from "@/lib/server/recipes/public";
import { cachedArticleCards, cachedCatalog } from "@/lib/server/recipes/public-cache";

import { otherLocale, pageLocale } from "../_components/page-locale";
import { pageMetadata } from "../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../_components/public-header";

// Статьи `/{locale}/articles` (ADR-0034, ADR-0038): опубликованные, новые сверху; на /en — переведённые. Пустой список
// не индексируется.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await pageLocale();
  const t = await getTranslations("Articles");
  await io();
  const empty = (await cachedArticleCards(locale)).length === 0;
  const paths = { ru: "/ru/articles", en: "/en/articles" };
  return pageMetadata({ locale, paths, title: t("title"), noindex: empty });
}

export default async function ArticlesPage() {
  const locale = await pageLocale();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <ArticlesScreen locale={locale} />
    </Suspense>
  );
}

async function ArticlesScreen({ locale }: { locale: Locale }) {
  await io();
  const [catalog, articles, t] = await Promise.all([cachedCatalog(locale), cachedArticleCards(locale), getTranslations("Articles")]);
  return (
    <>
      <PublicHeader locale={locale} sections={catalog.sections} alternate={`/${otherLocale(locale)}/articles`} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-16 lg:px-8 lg:pt-10">
        <h1 className="font-display text-display-sm text-primary">{t("title")}</h1>
        {articles.length === 0 ? (
          <p className="text-md text-tertiary">{t("empty")}</p>
        ) : (
          <ArticleGrid cards={articles.map((card) => ({ href: articlePath(locale, card.slug), title: card.title, excerpt: card.excerpt, photo: card.photo }))} />
        )}
      </main>
    </>
  );
}
