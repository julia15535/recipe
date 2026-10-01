import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";

import { PrototypeBar } from "../../_components/prototype-bar";
import { RecipeBody } from "../../_components/recipe-body";
import { RecipeIntro } from "../../_components/recipe-intro";
import { HEADER } from "../../_demo/demo-catalog";
import { RECIPES } from "../../_demo/demo-recipes";
import { findRecipe } from "../../_demo/demo-selection";

// Прототип страницы рецепта (решения владельца 01.10): метки-разделы, строка «время + цветные теги»
// (ADR-0021), без «−/+» — вписать своё количество основного ингредиента (ADR-0016), КБЖУ пока нет.
export function generateStaticParams() {
  return RECIPES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/admin/ui/recipe/[slug]">): Promise<Metadata> {
  const recipe = findRecipe((await params).slug);
  return { title: `${recipe?.title ?? "Рецепт"} — пробный экран · Книга рецептов` };
}

export default async function RecipePrototypePage({ params }: PageProps<"/admin/ui/recipe/[slug]">) {
  const recipe = findRecipe((await params).slug);
  if (!recipe) notFound();

  return (
    <>
      <PrototypeBar note="пересчёт без округления" />
      <SiteHeader {...HEADER} />
      <main>
        <RecipeBody recipe={recipe}>
          <RecipeIntro recipe={recipe} />
        </RecipeBody>
      </main>
    </>
  );
}
