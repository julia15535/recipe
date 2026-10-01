import { RECIPES } from "../_demo/demo-recipes";
import { POPULAR, WEEKLY, pickRecipes } from "../_demo/demo-selection";
import type { DemoRecipe } from "../_demo/demo-types";
import { RecipeGrid } from "./recipe-card";

// Главная под шапкой (каталог — в шапке): «Подборка недели» и «Популярное» внизу; без рецептов —
// «Скоро здесь появятся рецепты».
export function HomeContent({ recipes = RECIPES }: { recipes?: DemoRecipe[] }) {
  const weekly = pickRecipes(WEEKLY.slugs, recipes);
  const popular = pickRecipes(POPULAR, recipes);

  return (
    <>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pt-6 pb-16 lg:px-8 lg:pt-10">
        <h1 className="sr-only">Книга рецептов</h1>

        {recipes.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-display text-display-xs text-primary">Скоро здесь появятся рецепты</p>
            <p className="text-md text-tertiary">Автор готовит первые рецепты — загляните чуть позже.</p>
          </div>
        )}

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
