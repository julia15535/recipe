import { Clock } from "lucide-react";
import NextLink from "next/link";

import { CompositionTags } from "@/components/recipe/composition-tags";
import { cx } from "@/utils/cx";

import type { RecipeView } from "./view";

// Шапка рецепта: разделы спокойной строкой (ADR-0018; ссылка — если есть страница раздела), название,
// описание, строка «время + теги состава своим цветом» (ADR-0021); фото пока нет — у прототипов заглушка.
export function RecipeIntro({ recipe }: { recipe: RecipeView }) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Разделы каталога">
        <ul className="flex flex-wrap items-center text-sm font-semibold tracking-wide uppercase">
          {recipe.sections.map((section, index) => (
            <li key={section.code} className="flex items-center">
              {index > 0 && (
                <span aria-hidden className="px-2 text-quaternary">
                  ·
                </span>
              )}
              {section.href ? (
                <NextLink
                  href={section.href}
                  className="inline-flex min-h-11 items-center text-brand-secondary underline-offset-4 hover:underline"
                >
                  {section.label}
                </NextLink>
              ) : (
                <span className="inline-flex min-h-11 items-center text-brand-secondary">{section.label}</span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <h1 className="font-display text-display-sm break-words text-primary lg:text-display-md">{recipe.title}</h1>
      {recipe.description && <p className="text-lg break-words text-tertiary">{recipe.description}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="recipe-meta">
        {recipe.time && (
          <p className="flex items-center gap-1.5 text-md text-secondary">
            <Clock className="size-5" aria-hidden />
            {recipe.time}
          </p>
        )}
        <CompositionTags tags={recipe.tags} label="Особенности состава" />
      </div>
      {recipe.tone && <div className={cx("mt-2 aspect-[3/2] rounded-2xl bg-linear-to-br lg:aspect-[16/9]", recipe.tone)} aria-hidden />}
    </div>
  );
}
