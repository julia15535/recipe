import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";

import { RecipeBody } from "@/components/recipe/recipe-body";
import { RecipeIntro } from "@/components/recipe/recipe-intro";
import { photoUrl } from "@/lib/domain/photo";
import { cachedCatalog, cachedRecipe } from "@/lib/server/recipes/public-cache";

import { pageMetadata } from "../../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../../_components/public-header";

type Props = PageProps<"/[locale]/recipe/[slug]">;

// Рецепт `/ru/recipe/{slug}` (ADR-0027): только опубликованный; черновик, снятый, неизвестный — 404. Пересчёт и
// округление — в браузере (`components/recipe`), разделы над названием — ссылки на страницы разделов.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  if (locale !== "ru") return {};
  const { slug } = await params;
  await io();
  const recipe = await cachedRecipe(locale, slug);
  if (!recipe) return { robots: { index: false, follow: false } };
  const { photo, title, description } = recipe.view;
  return pageMetadata({ locale, path: `/recipe/${slug}`, title, description, image: photo ? photoUrl(photo.id, "og.jpg") : null });
}

export default async function RecipePage({ params }: Props) {
  if ((await getLocale()) !== "ru") notFound();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <RecipeScreen params={params} />
    </Suspense>
  );
}

async function RecipeScreen({ params }: Pick<Props, "params">) {
  await io();
  const { slug } = await params;
  const [catalog, recipe] = await Promise.all([cachedCatalog("ru"), cachedRecipe("ru", slug)]);
  if (!recipe) notFound();
  return (
    <>
      <PublicHeader locale="ru" sections={catalog.sections} />
      <main>
        <RecipeBody recipe={recipe.view}>
          <RecipeIntro recipe={recipe.view} />
        </RecipeBody>
      </main>
    </>
  );
}
