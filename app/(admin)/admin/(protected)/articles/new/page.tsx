import type { Metadata } from "next";

import { AppButton } from "@/components/app-button";
import { requireOwner } from "@/lib/server/auth/owner";
import { getAiConfig } from "@/lib/server/env";

import { ArticleEditor } from "../_components/article-editor";

export const metadata: Metadata = { title: "Новая статья · Кабинет владельца" };

export default async function NewArticlePage() {
  await requireOwner();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <AppButton color="tertiary" href="/admin" className="self-start">
        ← Кабинет
      </AppButton>
      <h1 className="font-display text-display-xs text-primary">Новая статья</h1>
      <ArticleEditor aiEnabled={getAiConfig() !== null} />
    </main>
  );
}
