"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";

import { AppButton } from "@/components/app-button";
import { cx } from "@/utils/cx";

import { saveRelatedRecipes } from "../actions";

// Связанные рецепты статьи: чипы — касанием по всему чипу (ui-rules), выбранные — первыми и по порядку выбора;
// снятый с публикации рецепт на сайте не показывается (связь остаётся) — помечен «черновик».
type Recipe = { id: string; title: string; status: "draft" | "published" };
type Props = { articleId: string; revision: number; recipes: Recipe[]; selected: string[] };

export function RelatedRecipes({ articleId, revision, recipes, selected: initial }: Props) {
  const [selected, setSelected] = useState(initial);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const query = filter.trim().toLowerCase();
  const shown = [...selected.flatMap((id) => recipes.filter((recipe) => recipe.id === id)), ...recipes.filter((recipe) => !selected.includes(recipe.id))].filter(
    (recipe) => !query || recipe.title.toLowerCase().includes(query),
  );
  const save = () =>
    start(async () => {
      try {
        const result = await saveRelatedRecipes({ articleId, revision, recipeIds: selected });
        setMessage(result.ok ? "Связи сохранены." : result.message);
      } catch {
        setMessage("Нет связи с сайтом — попробуйте ещё раз.");
      }
    });
  const changed = selected.join() !== initial.join();
  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-3 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
      <h2 id="related-title" className="font-display text-xl text-primary">
        Связанные рецепты
      </h2>
      <p className="text-md text-tertiary">Их карточки будут внизу статьи, а на страницах рецептов — ссылка на статью.</p>
      {recipes.length > 8 && (
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Найти рецепт"
          placeholder="Найти рецепт"
          className="min-h-11 w-full rounded-xl bg-primary p-3 text-md text-primary ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-brand"
        />
      )}
      <ul className="flex flex-wrap gap-2">
        {shown.map((recipe) => {
          const on = selected.includes(recipe.id);
          return (
            <li key={recipe.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(recipe.id)}
                className={cx(
                  "flex min-h-11 items-center gap-1.5 rounded-full px-4 text-md ring-1 ring-inset",
                  on ? "bg-accent-100 font-semibold text-primary ring-accent-300" : "bg-primary text-secondary ring-secondary",
                )}
              >
                {on && <Check className="size-4" aria-hidden />}
                {recipe.title}
                {recipe.status === "draft" && <span className="text-sm text-tertiary">· черновик</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <AppButton onPress={save} isDisabled={pending || !changed}>
          Сохранить связи
        </AppButton>
        <p aria-live="polite" className="text-md text-secondary empty:hidden">
          {message}
        </p>
      </div>
    </section>
  );
}
