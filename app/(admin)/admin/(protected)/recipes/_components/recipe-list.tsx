import NextLink from "next/link";

import type { RecipeListItem } from "@/lib/server/recipes/queries";

import { StatusBadge } from "./status-badge";

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// «Мои рецепты»: название (ссылка на рецепт), статус, когда меняли; пусто — подсказка, что делать.
export function RecipeList({ recipes }: { recipes: RecipeListItem[] }) {
  if (recipes.length === 0) {
    return <p className="text-md text-tertiary">Рецептов пока нет. Нажмите «Добавить рецепт» и вставьте текст — как пишете обычно.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-secondary">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <NextLink
            href={`/admin/recipes/${recipe.id}`}
            className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 underline-offset-4 hover:underline"
          >
            <span className="text-md font-semibold break-words text-primary">{recipe.title}</span>
            <span className="flex items-center gap-3 text-sm text-tertiary">
              {DATE.format(recipe.updatedAt)}
              <StatusBadge status={recipe.status} />
            </span>
          </NextLink>
        </li>
      ))}
    </ul>
  );
}
