"use client";

import type { ReactNode } from "react";

import { AppButton } from "@/components/app-button";
import { type CardData, RecipeGrid } from "@/components/recipe/recipe-card";
import { hasCriteria, type SearchQuery } from "@/lib/domain/search";

type Props = { query: SearchQuery; total: number; found: CardData[]; onReset: () => void };

// Результаты и два разных пустых состояния: «рецептов пока нет» (опубликованных нет) и «ничего не нашлось».
export function SearchResults(props: Props) {
  return (
    <section aria-label="Результаты" className="flex w-full flex-col gap-4 lg:mx-auto lg:max-w-5xl">
      <div aria-live="polite" className="flex flex-col gap-4">
        <ResultsState {...props} />
      </div>
    </section>
  );
}

function ResultsState({ query, total, found, onReset }: Props) {
  if (total === 0) return <Message title="Рецепты скоро появятся" text="Автор готовит первые рецепты — загляните чуть позже." />;
  if (!hasCriteria(query)) return <p className="text-md text-tertiary lg:text-center">Начните вводить название или выберите ингредиенты.</p>;
  if (found.length === 0)
    return (
      <Message title="Ничего не нашлось" text="Попробуйте убрать уточнения или выбрать другой ингредиент.">
        <AppButton color="secondary" onPress={onReset} className="self-start">
          Сбросить поиск
        </AppButton>
      </Message>
    );
  return (
    <>
      <p className="text-sm text-tertiary lg:text-center">Нашлось: {found.length}</p>
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
