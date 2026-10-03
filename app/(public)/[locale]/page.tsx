import type { Metadata } from "next";
import { io } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AppButton } from "@/components/app-button";
import { RecipeGrid } from "@/components/recipe/recipe-card";
import { cachedCatalog, cachedNewRecipes } from "@/lib/server/recipes/public-cache";

import { toCards } from "./_components/cards";
import { pageMetadata } from "./_components/page-metadata";
import { HeaderFallback, PublicHeader } from "./_components/public-header";

// Главная (владелец 02.10: «Каталог + «Новые рецепты»»): шапка с каталогом и до 12 последних опубликованных
// рецептов. Английской версии пока нет — `/en` заглушка с noindex (план public-pages).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale !== "ru") return { title: (await getTranslations("Soon"))("title"), robots: { index: false, follow: false } };
  return pageMetadata({ locale, path: "/" });
}

export default async function HomePage() {
  if ((await getLocale()) !== "ru") return <ComingSoon />;
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HomeScreen />
    </Suspense>
  );
}

async function HomeScreen() {
  await io();
  const [catalog, recipes, t, meta] = await Promise.all([cachedCatalog("ru"), cachedNewRecipes("ru"), getTranslations("Home"), getTranslations("Meta")]);
  return (
    <>
      <PublicHeader locale="ru" sections={catalog.sections} />
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
            <RecipeGrid cards={toCards("ru", recipes)} />
          </section>
        )}
      </main>
    </>
  );
}

async function ComingSoon() {
  const t = await getTranslations("Soon");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-display-sm text-primary">{t("title")}</h1>
      <p className="text-lg text-tertiary">{t("lead")}</p>
      <AppButton href="/ru" className="self-start">
        {t("open")}
      </AppButton>
    </main>
  );
}
