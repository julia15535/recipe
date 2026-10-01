import { Clock } from "lucide-react";
import NextLink from "next/link";

import { cx } from "@/utils/cx";

import { PROTOTYPE, sectionLabel } from "../_demo/demo-catalog";
import type { DemoRecipe } from "../_demo/demo-recipes";

// Шапка рецепта: метки-разделы спокойной строкой ссылок (ADR-0018, не цветные бейджи), название,
// описание, время, теги состава (ADR-0019) и фото (пока заглушка из палитры).
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
      <p className="text-lg text-tertiary">{recipe.description}</p>
      <p className="flex items-center gap-1.5 text-md text-secondary">
        <Clock className="size-5" aria-hidden />
        {recipe.time}
      </p>
      <CompositionBlock tags={recipe.composition} />
      <div className={cx("mt-2 aspect-[3/2] rounded-2xl bg-linear-to-br lg:aspect-[2/1]", recipe.tone)} aria-hidden />
    </div>
  );
}

// Особенности состава: нейтральные чипы без «цвета здоровья» и подпись — это оценка автора, не КБЖУ.
function CompositionBlock({ tags }: { tags: DemoRecipe["composition"] }) {
  if (tags.length === 0) return null;
  return (
    <section aria-labelledby="composition" className="flex flex-col gap-2 pt-1">
      <h2 id="composition" className="text-sm font-semibold text-secondary">
        Особенности состава
      </h2>
      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag} className="rounded-full px-3 py-1 text-sm text-secondary ring-1 ring-primary ring-inset">
            {tag}
          </li>
        ))}
      </ul>
      <p className="text-sm text-tertiary">Отмечено автором по ингредиентам, это не расчёт КБЖУ.</p>
    </section>
  );
}
