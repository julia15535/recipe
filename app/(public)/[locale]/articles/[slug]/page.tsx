import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ArticleBody } from "@/components/article/article-body";
import { photoUrl } from "@/lib/domain/photo";
import { articlePath } from "@/lib/server/articles/public";
import type { Locale } from "@/lib/server/recipes/public";
import { cachedArticle, cachedCatalog } from "@/lib/server/recipes/public-cache";

import { otherLocale, pageLocale } from "../../_components/page-locale";
import { pageMetadata } from "../../_components/page-metadata";
import { HeaderFallback, PublicHeader } from "../../_components/public-header";

type Props = PageProps<"/[locale]/articles/[slug]">;

// Статья `/{locale}/articles/{slug}` (ADR-0034): только опубликованная; черновик, снятая, неизвестная — 404. Превью
// ссылки — первое фото статьи и анонс (первый абзац).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale();
  const { slug } = await params;
  await io();
  const article = await cachedArticle(locale, slug);
  if (!article) return { robots: { index: false, follow: false } };
  return pageMetadata({
    locale,
    paths: { [locale]: articlePath(locale, article.slug) },
    title: article.view.title,
    description: article.excerpt,
    image: article.cover ? photoUrl(article.cover.id, "og.jpg", "article") : null,
  });
}

export default async function ArticlePage({ params }: Props) {
  const locale = await pageLocale();
  return (
    <Suspense fallback={<HeaderFallback />}>
      <ArticleScreen params={params} locale={locale} />
    </Suspense>
  );
}

async function ArticleScreen({ params, locale }: Pick<Props, "params"> & { locale: Locale }) {
  await io();
  const { slug } = await params;
  const [catalog, article, t] = await Promise.all([cachedCatalog(locale), cachedArticle(locale, slug), getTranslations("Articles")]);
  if (!article) notFound();
  return (
    <>
      <PublicHeader locale={locale} sections={catalog.sections} alternate={`/${otherLocale(locale)}`} />
      <main className="pt-6 pb-16 lg:pt-10">
        <ArticleBody view={article.view} recipesLabel={t("recipes")} />
      </main>
    </>
  );
}
