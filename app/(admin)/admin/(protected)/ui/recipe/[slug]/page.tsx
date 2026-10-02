import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { requireOwner } from "@/lib/server/auth/owner";

import { PrototypeBar } from "../../_components/prototype-bar";
import { RecipeBody } from "../../_components/recipe-body";
import { RecipeIntro } from "../../_components/recipe-intro";
import { findRecipe, headerProps } from "../../_demo/demo-selection";

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

  return (
    <>
      <PrototypeBar note="пересчёт без округления" />
      <SiteHeader {...headerProps()} />
      <main>
        <RecipeBody recipe={recipe}>
          <RecipeIntro recipe={recipe} />
        </RecipeBody>
      </main>
    </>
  );
}
