import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AppButton } from "@/components/app-button";
import { getArticle } from "@/lib/server/articles/queries";
import { requireOwner } from "@/lib/server/auth/owner";
import { getAiConfig } from "@/lib/server/env";

import { ArticleEditor } from "../../_components/article-editor";

export const metadata: Metadata = { title: "Изменить статью · Кабинет владельца" };

// Правка — текст целиком (с метками фото на своих строках): адрес, статус и фото не меняются.
export default async function EditArticlePage({ params }: PageProps<"/admin/articles/[id]/edit">) {
  await requireOwner();
  const id = z.uuid().safeParse((await params).id);
  const article = id.success ? await getArticle(id.data) : null;
  if (!article) notFound();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <AppButton color="tertiary" href={`/admin/articles/${article.id}`} className="self-start">
        ← К статье
      </AppButton>
      <h1 className="font-display text-display-xs break-words text-primary">Изменить: {article.title}</h1>
      <ArticleEditor
        initialTitle={article.title}
        initialText={article.sourceText}
        article={{ id: article.id, revision: article.revision }}
        aiEnabled={getAiConfig() !== null}
      />
    </main>
  );
}
