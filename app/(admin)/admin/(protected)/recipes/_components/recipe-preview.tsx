import { RecipeBody } from "@/components/recipe/recipe-body";
import { RecipeIntro } from "@/components/recipe/recipe-intro";
import type { RecipeView } from "@/components/recipe/view";

/** Предпросмотр — та же страница рецепта, что будет на сайте. `version` сбрасывает поле пересчёта. */
export function RecipePreview({ view, version }: { view: RecipeView; version: number }) {
  return (
    <section aria-label="Так рецепт будет выглядеть на сайте" className="-mx-4 rounded-2xl ring-1 ring-secondary sm:mx-0">
      <p className="px-4 pt-4 text-sm text-tertiary">Так рецепт будет выглядеть на сайте</p>
      <RecipeBody key={version} recipe={view}>
        <RecipeIntro recipe={view} />
      </RecipeBody>
    </section>
  );
}
