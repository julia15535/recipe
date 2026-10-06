import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AppButton } from "@/components/app-button";
import { articlePath } from "@/lib/server/articles/public";
import { getArticle } from "@/lib/server/articles/queries";
import { toArticleView } from "@/lib/server/articles/view";
import { requireOwner } from "@/lib/server/auth/owner";
import { listRecipes } from "@/lib/server/recipes/queries";

import { StatusBadge } from "../../recipes/_components/status-badge";
import { ArticleActions } from "../_components/article-actions";
import { ArticleWorkspace } from "../_components/article-workspace";
import { RelatedRecipes } from "../_components/related-recipes";

export const metadata: Metadata = { title: "Статья · Кабинет владельца" };

// Статья в кабинете — как будет на сайте, с фото между абзацами, плюс статус, действия и связанные рецепты.
export default async function ArticlePage({ params }: PageProps<"/admin/articles/[id]">) {
  await requireOwner();
  const id = z.uuid().safeParse((await params).id);
  const [article, recipes] = id.success ? await Promise.all([getArticle(id.data), listRecipes()]) : [null, []];
  if (!article) notFound();
  const placed = new Set(article.body.blocks.flatMap((block) => (block.type === "photo" ? [block.key] : [])));
  const photos = [...article.photos.values()].map((photo) => ({ ...photo, placed: placed.has(photo.key) }));
  const view = toArticleView(article.title, article.body, article.photos, []);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 py-6">
      <div className="flex flex-col gap-4 px-4">
        <AppButton color="tertiary" href="/admin" className="self-start">
          ← Кабинет
        </AppButton>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={article.status} />
        </div>
        <ArticleActions id={article.id} status={article.status} siteHref={articlePath("ru", article.slug)} />
        <RelatedRecipes
          articleId={article.id}
          revision={article.revision}
          recipes={recipes.map(({ id: recipeId, title, status }) => ({ id: recipeId, title, status }))}
          selected={article.recipes.map((recipe) => recipe.id)}
        />
      </div>
      <ArticleWorkspace articleId={article.id} revision={article.revision} view={view} photos={photos} />
    </main>
  );
}
