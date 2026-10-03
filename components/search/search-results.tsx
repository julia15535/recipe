"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { AppButton } from "@/components/app-button";
import { type CardData, RecipeGrid } from "@/components/recipe/recipe-card";
import { hasCriteria, type SearchQuery } from "@/lib/domain/search";

type Props = { query: SearchQuery; total: number; found: CardData[]; onReset: () => void };

// Результаты и два разных пустых состояния: «рецептов пока нет» (опубликованных нет) и «ничего не нашлось».
export function SearchResults(props: Props) {
  const t = useTranslations("Search");
  return (
    <section aria-label={t("results")} className="flex w-full flex-col gap-4 lg:mx-auto lg:max-w-5xl">
      <div aria-live="polite" className="flex flex-col gap-4">
        <ResultsState {...props} />
      </div>
    </section>
  );
}

function ResultsState({ query, total, found, onReset }: Props) {
  const t = useTranslations("Search");
  if (total === 0) return <Message title={t("emptyTitle")} text={t("emptyText")} />;
  if (!hasCriteria(query)) return <p className="text-md text-tertiary lg:text-center">{t("start")}</p>;
  if (found.length === 0)
    return (
      <Message title={t("nothingTitle")} text={t("nothingText")}>
        <AppButton color="secondary" onPress={onReset} className="self-start">
          {t("reset")}
        </AppButton>
      </Message>
    );
  return (
    <>
      <p className="text-sm text-tertiary lg:text-center">{t("found", { count: found.length })}</p>
      <RecipeGrid cards={found} />
    </>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-primary p-6 ring-1 ring-secondary lg:mx-auto lg:max-w-3xl">
      <p className="font-display text-xl text-primary">{title}</p>
      <p className="text-md text-tertiary">{text}</p>
      {children}
    </div>
  );
}
