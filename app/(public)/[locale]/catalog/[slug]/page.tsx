import type { Metadata } from "next";
import { io } from "next/cache";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { RecipeGrid } from "@/components/recipe/recipe-card";
import { type Locale, sectionPath } from "@/lib/server/recipes/public";
import { cachedCatalog, cachedSectionRecipes } from "@/lib/server/recipes/public-cache";

import { toCards } from "../../_components/cards";
import { otherLocale, pageLocale } from "../../_components/page-locale";
import { pageMetadata } from "../../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../../_components/public-header";

type Props = PageProps<"/[locale]/catalog/[slug]">;

// Раздел каталога `/{locale}/catalog/{slug}` (ADR-0017): крошки, заголовок, рецепты раздела — и те, где он не
// основной. Пустой раздел существует (из меню туда не попасть, только по адресу) — «Пока нет рецептов» и noindex;
// неизвестный — 404. Адрес раздела на другом языке — по коду раздела (ADR-0029).
async function sectionPair(locale: Locale, slug: string) {
  const [catalog, other] = await Promise.all([cachedCatalog(locale), cachedCatalog(otherLocale(locale))]);
  const section = catalog.sections.find((item) => item.slug === slug);
  const twin = section && other.sections.find((item) => item.code === section.code);
  return { catalog, section, paths: section && twin ? { [locale]: sectionPath(locale, slug), [otherLocale(locale)]: sectionPath(otherLocale(locale), twin.slug) } : {} };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale();
  const { slug } = await params;
  await io();
  const { section, paths } = await sectionPair(locale, slug);
  if (!section) return { robots: { index: false, follow: false } };
  return pageMetadata({ locale, paths, title: section.label, noindex: section.recipes === 0 });
}

export default async function SectionPage({ params }: Props) {
  const locale = await pageLocale();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <SectionScreen params={params} locale={locale} />
    </Suspense>
  );
}

async function SectionScreen({ params, locale }: Pick<Props, "params"> & { locale: Locale }) {
  await io();
  const { slug } = await params;
  const { catalog, section, paths } = await sectionPair(locale, slug);
  if (!section) notFound();
  const recipes = section.recipes > 0 ? await cachedSectionRecipes(locale, section.code) : [];
  const t = await getTranslations("Section");

  return (
    <>
      <PublicHeader locale={locale} sections={catalog.sections} current={section.code} alternate={paths[otherLocale(locale)] ?? `/${otherLocale(locale)}`} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-16 lg:px-8 lg:pt-8">
        <nav aria-label={t("breadcrumbs")}>
          <ol className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
            <li>
              <NextLink href={`/${locale}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
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
            <RecipeGrid cards={toCards(locale, recipes)} />
          </section>
        ) : (
          <p className="text-lg text-tertiary">{t("empty")}</p>
        )}
      </main>
    </>
  );
}
