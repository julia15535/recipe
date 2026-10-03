import type { Metadata } from "next";
import { io } from "next/cache";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { RecipeGrid } from "@/components/recipe/recipe-card";
import { cachedCatalog, cachedSectionRecipes } from "@/lib/server/recipes/public-cache";

import { toCards } from "../../_components/cards";
import { pageMetadata } from "../../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../../_components/public-header";

type Props = PageProps<"/[locale]/catalog/[slug]">;

// Раздел каталога `/ru/catalog/{slug}` (ADR-0017): крошки, заголовок, рецепты раздела — и те, где он не основной.
// Пустой раздел существует (из меню туда не попасть, только по адресу) — «Пока нет рецептов» и noindex;
// неизвестный — 404. Адрес раздела — из базы (`section_localizations.slug`).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  if (locale !== "ru") return {};
  const { slug } = await params;
  await io();
  const section = (await cachedCatalog(locale)).sections.find((item) => item.slug === slug);
  if (!section) return { robots: { index: false, follow: false } };
  return pageMetadata({ locale, path: `/catalog/${slug}`, title: section.label, noindex: section.recipes === 0 });
}

export default async function SectionPage({ params }: Props) {
  if ((await getLocale()) !== "ru") notFound();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <SectionScreen params={params} />
    </Suspense>
  );
}

async function SectionScreen({ params }: Pick<Props, "params">) {
  await io();
  const { slug } = await params;
  const catalog = await cachedCatalog("ru");
  const section = catalog.sections.find((item) => item.slug === slug);
  if (!section) notFound();
  const recipes = section.recipes > 0 ? await cachedSectionRecipes("ru", section.code) : [];
  const t = await getTranslations("Section");

  return (
    <>
      <PublicHeader locale="ru" sections={catalog.sections} current={section.code} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-16 lg:px-8 lg:pt-8">
        <nav aria-label={t("breadcrumbs")}>
          <ol className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
            <li>
              <NextLink href="/ru" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                {t("home")}
              </NextLink>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-secondary">
              {section.label}
            </li>
          </ol>
        </nav>
        <h1 className="font-display text-display-sm text-primary lg:text-display-md">{section.label}</h1>
        {recipes.length > 0 ? (
          <section aria-labelledby="section-recipes">
            <h2 id="section-recipes" className="sr-only">
              {t("recipes")}
            </h2>
            <RecipeGrid cards={toCards("ru", recipes)} />
          </section>
        ) : (
          <p className="text-lg text-tertiary">{t("empty")}</p>
        )}
      </main>
    </>
  );
}
