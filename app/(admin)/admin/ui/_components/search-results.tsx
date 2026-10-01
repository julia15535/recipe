"use client";

import { type ReactNode, useState } from "react";

import { AppButton } from "@/components/app-button";

import { type DemoQuery, hasCriteria, searchDemo } from "../_demo/demo-search";
import { RecipeGrid } from "./recipe-card";

// Результаты и два разных пустых состояния: «рецептов пока нет» (каталог пуст — на сайте сейчас так)
// и «ничего не нашлось» (по запросу). Первое в прототипе включается кнопкой внизу.
export function SearchResults({ query, onReset }: { query: DemoQuery; onReset: () => void }) {
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const found = searchDemo(query);

  return (
    <section aria-label="Результаты" className="flex flex-col gap-4">
      <div aria-live="polite" className="flex flex-col gap-4">
        {catalogEmpty ? (
          <Message title="Рецепты скоро появятся" text="Автор готовит первые рецепты — загляните чуть позже." />
        ) : !hasCriteria(query) ? (
          <p className="text-md text-tertiary">Начните вводить название или выберите ингредиенты.</p>
        ) : found.length === 0 ? (
          <Message title="Ничего не нашлось" text="Попробуйте убрать уточнения или выбрать другой ингредиент.">
            <AppButton color="secondary" onPress={onReset} className="self-start">
              Сбросить поиск
            </AppButton>
          </Message>
        ) : (
          <>
            <p className="text-sm text-tertiary">Нашлось: {found.length}</p>
            <RecipeGrid recipes={found} />
          </>
        )}
      </div>
      <AppButton color="tertiary" onPress={() => setCatalogEmpty((value) => !value)} className="self-start">
        {catalogEmpty ? "Вернуть примерные рецепты" : "Как выглядит без рецептов"}
      </AppButton>
    </section>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-primary p-6 ring-1 ring-secondary">
      <p className="font-display text-xl text-primary">{title}</p>
      <p className="text-md text-tertiary">{text}</p>
      {children}
    </div>
  );
}
