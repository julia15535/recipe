import { Clock } from "lucide-react";
import NextLink from "next/link";

import { cx } from "@/utils/cx";

import { PROTOTYPE, sectionLabel } from "../_demo/demo-catalog";
import type { DemoRecipe } from "../_demo/demo-recipes";

// Фото-карточка рецепта (фото главное; 2 колонки на телефоне, 4 на компьютере). Вместо фото — заглушка
// из палитры: настоящих снимков блюд пока нет. Над названием — основной раздел (ADR-0018).
export function RecipeCard({ recipe }: { recipe: DemoRecipe }) {
  return (
    <NextLink
      href={PROTOTYPE.recipe(recipe.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className={cx("aspect-[4/5] bg-linear-to-br lg:aspect-[4/3]", recipe.tone)} aria-hidden />
      <div className="flex flex-col gap-1.5 p-3">
        <span className="text-xs font-semibold tracking-wide text-brand-secondary uppercase">{sectionLabel(recipe.sections[0])}</span>
        <h3 className="font-display text-lg leading-snug text-primary group-hover:underline">{recipe.title}</h3>
        <span className="flex items-center gap-1 text-sm text-tertiary">
          <Clock className="size-4" aria-hidden />
          {recipe.time}
        </span>
      </div>
    </NextLink>
  );
}

export function RecipeGrid({ recipes }: { recipes: DemoRecipe[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
      {recipes.map((recipe) => (
        <li key={recipe.slug}>
          <RecipeCard recipe={recipe} />
        </li>
      ))}
    </ul>
  );
}
