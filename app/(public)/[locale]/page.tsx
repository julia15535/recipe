import type { Metadata } from "next";
import { io } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ArticleGrid } from "@/components/article/article-card";
import { AppButton } from "@/components/app-button";
import { RecipeGrid } from "@/components/recipe/recipe-card";
import { articlePath } from "@/lib/server/articles/public";
import type { Locale } from "@/lib/server/recipes/public";
import { cachedArticleCards, cachedCatalog, cachedNewRecipes } from "@/lib/server/recipes/public-cache";

import { toCards } from "./_components/cards";
import { otherLocale, pageLocale } from "./_components/page-locale";
import { pageMetadata } from "./_components/page-metadata";
import { HeaderFallback, PublicHeader } from "./_components/public-header";

// Главная (владелец 02.10: «Каталог + «Новые рецепты»»): шапка с каталогом и до 12 последних опубликованных
// рецептов; на английском — только переведённые (ADR-0029). Ниже — «Статьи» (до 3, ADR-0034; пока только по-русски).
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ locale: await pageLocale(), path: "/" });
}

export default async function HomePage() {
  const locale = await pageLocale();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HomeScreen locale={locale} />
    </Suspense>
  );
}

async function HomeScreen({ locale }: { locale: Locale }) {
  await io();
  const [catalog, recipes, articles, t, meta, a] = await Promise.all([
    cachedCatalog(locale),
    cachedNewRecipes(locale),
    cachedArticleCards(locale, 3),
    getTranslations("Home"),
    getTranslations("Meta"),
    getTranslations("Articles"),
  ]);
  return (
    <>
      <PublicHeader locale={locale} sections={catalog.sections} alternate={`/${otherLocale(locale)}`} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-16 lg:px-8 lg:pt-10">
        <h1 className="sr-only">{meta("siteName")}</h1>
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-display text-display-xs text-primary">{t("emptyTitle")}</p>
            <p className="text-md text-tertiary">{t("emptyText")}</p>
          </div>
        ) : (
          <section aria-labelledby="new-recipes" className="flex flex-col gap-4">
            <h2 id="new-recipes" className="font-display text-display-xs text-primary">
              {t("newRecipes")}
            </h2>
            <RecipeGrid cards={toCards(locale, recipes)} />
          </section>
        )}
        {articles.length > 0 && (
          <section aria-labelledby="home-articles" className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="home-articles" className="font-display text-display-xs text-primary">
                {a("home")}
              </h2>
              <AppButton color="tertiary" href={`/${locale}/articles`}>
                {a("all")}
              </AppButton>
            </div>
            <ArticleGrid cards={articles.map((card) => ({ href: articlePath(locale, card.slug), title: card.title, excerpt: card.excerpt, photo: card.photo }))} />
          </section>
        )}
      </main>
    </>
  );
}
