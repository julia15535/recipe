import { Clock } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";

import { CompositionTags } from "@/components/recipe/composition-tags";
import { RecipePhoto } from "@/components/recipe/recipe-photo";
import { cx } from "@/utils/cx";

import type { RecipeView } from "./view";

// Шапка рецепта: разделы спокойной строкой (ADR-0018; ссылка — если есть страница раздела), название,
// описание, строка «время + теги состава своим цветом» (ADR-0021); фото блюда 4:3 (ADR-0028); у прототипов — цветная заглушка.
export function RecipeIntro({ recipe }: { recipe: RecipeView }) {
  const t = useTranslations("Recipe");
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t("sections")}>
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
        <CompositionTags tags={recipe.tags} label={t("composition")} />
      </div>
      {recipe.photo ? (
        <RecipePhoto photo={recipe.photo} alt={recipe.title} sizes="(min-width: 768px) 736px, calc(100vw - 32px)" priority className="mt-2 rounded-2xl" />
      ) : (
        recipe.tone && <div className={cx("mt-2 aspect-[4/3] rounded-2xl bg-linear-to-br", recipe.tone)} aria-hidden />
      )}
    </div>
  );
}
