import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ArticleGrid } from "@/components/article/article-card";
import { RecipeBody } from "@/components/recipe/recipe-body";
import { RecipeIntro } from "@/components/recipe/recipe-intro";
import { photoUrl } from "@/lib/domain/photo";
import { type Locale, type PublicRecipe, recipePath } from "@/lib/server/recipes/public";
import { articlePath } from "@/lib/server/articles/public";
import { cachedCatalog, cachedRecipe, cachedRecipeArticles } from "@/lib/server/recipes/public-cache";

import { otherLocale, pageLocale } from "../../_components/page-locale";
import { pageMetadata } from "../../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../../_components/public-header";

type Props = PageProps<"/[locale]/recipe/[slug]">;

// Рецепт `/{locale}/recipe/{slug}` (ADR-0027): только опубликованный; на английском — только переведённый
// (ADR-0029), черновик, снятый, неизвестный — 404. Пересчёт и округление — в браузере (`components/recipe`).
const pathsOf = (locale: Locale, recipe: PublicRecipe) => ({
  [locale]: recipePath(locale, recipe.slug),
  ...(recipe.otherSlug ? { [otherLocale(locale)]: recipePath(otherLocale(locale), recipe.otherSlug) } : {}),
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale();
  const { slug } = await params;
  await io();
  const recipe = await cachedRecipe(locale, slug);
  if (!recipe) return { robots: { index: false, follow: false } };
  const { photo, title, description } = recipe.view;
  return pageMetadata({ locale, paths: pathsOf(locale, recipe), title, description, image: photo ? photoUrl(photo.id, "og.jpg") : null });
}

export default async function RecipePage({ params }: Props) {
  const locale = await pageLocale();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <RecipeScreen params={params} locale={locale} />
    </Suspense>
  );
}

async function RecipeScreen({ params, locale }: Pick<Props, "params"> & { locale: Locale }) {
  await io();
  const { slug } = await params;
  const [catalog, recipe, t, a] = await Promise.all([cachedCatalog(locale), cachedRecipe(locale, slug), getTranslations("Recipe"), getTranslations("Articles")]);
  if (!recipe) notFound();
  const articles = await cachedRecipeArticles(locale, recipe.id);
  const other = otherLocale(locale);
  const hasCup = recipe.view.ingredients.some((item) => item.unit === "стак.");
  return (
    <>
      <PublicHeader locale={locale} sections={catalog.sections} alternate={pathsOf(locale, recipe)[other] ?? `/${other}`} />
      <main>
        <RecipeBody recipe={recipe.view}>
          <RecipeIntro recipe={recipe.view} />
          {hasCup && t("cupNote") && <p className="text-sm text-tertiary">{t("cupNote")}</p>}
        </RecipeBody>
        {articles.length > 0 && (
          <section aria-labelledby="recipe-articles" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-16">
            <h2 id="recipe-articles" className="font-display text-display-xs text-primary">
              {a("related")}
            </h2>
            <ArticleGrid cards={articles.map((card) => ({ href: articlePath(locale, card.slug), title: card.title, excerpt: card.excerpt, photo: card.photo }))} />
          </section>
        )}
      </main>
    </>
  );
}
