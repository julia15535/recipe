import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RecipeBody } from "@/components/recipe/recipe-body";
import { RecipeIntro } from "@/components/recipe/recipe-intro";
import { SiteHeader } from "@/components/site-header";
import { requireOwner } from "@/lib/server/auth/owner";

import { PrototypeBar } from "../../_components/prototype-bar";
import { findRecipe, headerProps } from "../../_demo/demo-selection";
import { demoToView } from "../../_demo/demo-view";

// Прототип страницы рецепта (решения владельца 01.10): метки-разделы, строка «время + цветные теги»
// (ADR-0021), без «−/+» — вписать своё количество основного ингредиента (ADR-0016), КБЖУ пока нет.
export async function generateMetadata({ params }: PageProps<"/admin/ui/recipe/[slug]">): Promise<Metadata> {
  const recipe = findRecipe((await params).slug);
  return { title: `${recipe?.title ?? "Рецепт"} — пробный экран · Книга рецептов` };
}

export default async function RecipePrototypePage({ params }: PageProps<"/admin/ui/recipe/[slug]">) {
  await requireOwner();
  const recipe = findRecipe((await params).slug);
  if (!recipe) notFound();
  const view = demoToView(recipe);

  return (
    <>
      <PrototypeBar note="пересчёт без округления" />
      <SiteHeader {...headerProps()} />
      <main>
        <RecipeBody recipe={view}>
          <RecipeIntro recipe={view} />
        </RecipeBody>
      </main>
    </>
  );
}
