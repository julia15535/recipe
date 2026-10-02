import { Clock } from "lucide-react";
import NextLink from "next/link";

import { CompositionTags } from "@/components/recipe/composition-tags";
import { cx } from "@/utils/cx";

import { PROTOTYPE, compositionTags, sectionLabel } from "../_demo/demo-catalog";
import type { DemoRecipe } from "../_demo/demo-types";

// Шапка рецепта: метки-разделы спокойной строкой ссылок (ADR-0018, не цветные бейджи), название,
// описание, одна строка «время + теги состава своим цветом» (ADR-0021) и фото (пока заглушка из палитры).
export function RecipeIntro({ recipe }: { recipe: DemoRecipe }) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Разделы каталога">
        <ul className="flex flex-wrap items-center text-sm font-semibold tracking-wide uppercase">
          {recipe.sections.map((id, index) => (
            <li key={id} className="flex items-center">
              {index > 0 && (
                <span aria-hidden className="px-2 text-quaternary">
                  ·
                </span>
              )}
              <NextLink
                href={PROTOTYPE.section(id)}
                className="inline-flex min-h-11 items-center text-brand-secondary underline-offset-4 hover:underline"
              >
                {sectionLabel(id)}
              </NextLink>
            </li>
          ))}
        </ul>
      </nav>
      <h1 className="font-display text-display-sm text-primary lg:text-display-md">{recipe.title}</h1>
      {recipe.description && <p className="text-lg text-tertiary">{recipe.description}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="recipe-meta">
        {recipe.time && (
          <p className="flex items-center gap-1.5 text-md text-secondary">
            <Clock className="size-5" aria-hidden />
            {recipe.time}
          </p>
        )}
        <CompositionTags tags={compositionTags(recipe.composition)} label="Особенности состава" />
      </div>
      <div className={cx("mt-2 aspect-[3/2] rounded-2xl bg-linear-to-br lg:aspect-[16/9]", recipe.tone)} aria-hidden />
    </div>
  );
}
