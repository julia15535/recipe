"use client";

import type { ReactNode } from "react";

import { AppButton } from "@/components/app-button";

import { type DemoQuery, hasCriteria, searchDemo } from "../_demo/demo-search";
import type { DemoRecipe } from "../_demo/demo-types";
import { RecipeGrid } from "./recipe-card";

type Props = { query: DemoQuery; recipes: DemoRecipe[]; onReset: () => void };

// Результаты и два разных пустых состояния: «рецептов пока нет» (каталог пуст; в прототипе — режим
// «Рецептов: 0») и «ничего не нашлось» (по запросу). На компьютере — по центру под карточкой поиска.
export function SearchResults({ query, recipes, onReset }: Props) {
  return (
    <section aria-label="Результаты" className="flex w-full flex-col gap-4 lg:mx-auto lg:max-w-5xl">
      <div aria-live="polite" className="flex flex-col gap-4">
        <ResultsState query={query} recipes={recipes} onReset={onReset} />
      </div>
    </section>
  );
}

function ResultsState({ query, recipes, onReset }: Props) {
  if (recipes.length === 0) return <Message title="Рецепты скоро появятся" text="Автор готовит первые рецепты — загляните чуть позже." />;
  if (!hasCriteria(query)) return <p className="text-md text-tertiary lg:text-center">Начните вводить название или выберите ингредиенты.</p>;
  const found = searchDemo(query, recipes);
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
      <RecipeGrid recipes={found} />
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
