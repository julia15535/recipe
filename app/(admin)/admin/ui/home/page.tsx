import type { Metadata } from "next";

import { CatalogNav } from "@/components/catalog/catalog-nav";
import { SiteHeader } from "@/components/site-header";

import { PrototypeBar } from "../_components/prototype-bar";
import { RecipeGrid } from "../_components/recipe-card";
import { CATALOG, CATALOG_LABELS, HEADER } from "../_demo/demo-catalog";
import { POPULAR, WEEKLY, pickRecipes } from "../_demo/demo-selection";

export const metadata: Metadata = { title: "Главная — пробный экран · Книга рецептов" };

// Прототип главной (решения владельца 01.10): поиск — лупой в шапке, первым — каталог, ниже —
// «Подборка недели» (выбирает владелец), «Популярное» — в самом низу и пока только как пример.
export default function HomePrototypePage() {
  const weekly = pickRecipes(WEEKLY.slugs);
  const popular = pickRecipes(POPULAR);
  return (
    <>
      <PrototypeBar />
      <SiteHeader {...HEADER} />
      <CatalogNav sections={CATALOG} labels={CATALOG_LABELS} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pt-6 pb-16 lg:px-8 lg:pt-10">
        <h1 className="sr-only">Книга рецептов</h1>

        {weekly.length > 0 && (
          <section aria-labelledby="weekly" className="flex flex-col gap-4 rounded-3xl bg-accent-100 p-4 lg:p-8">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold tracking-wide text-accent-700 uppercase">Подборка недели</p>
              <h2 id="weekly" className="font-display text-display-xs text-primary lg:text-display-sm">
                {WEEKLY.title}
              </h2>
            </div>
            <RecipeGrid recipes={weekly} />
          </section>
        )}

        {popular.length > 0 && (
          <section aria-labelledby="popular" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="popular" className="font-display text-display-xs text-primary">
                Популярное
              </h2>
              <p className="text-sm text-tertiary">Появится позже, когда рецептов станет больше. Сейчас — пример.</p>
            </div>
            <RecipeGrid recipes={popular} />
          </section>
        )}
      </main>
    </>
  );
}
