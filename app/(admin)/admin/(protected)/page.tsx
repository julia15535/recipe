import { AppButton } from "@/components/app-button";
import { listArticles } from "@/lib/server/articles/queries";
import { requireOwner } from "@/lib/server/auth/owner";
import { listRecipes } from "@/lib/server/recipes/queries";

import { LogoutForm } from "./_components/logout-form";
import { ArticleList } from "./articles/_components/article-list";
import { RecipeList } from "./recipes/_components/recipe-list";

// Кабинет владельца: «Мои рецепты» и добавление (план recipe-upload), «Мои статьи» (ADR-0034), пробные экраны, выход.
export default async function AdminPage() {
  const owner = await requireOwner();
  const [recipes, articles] = await Promise.all([listRecipes(), listArticles()]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-xs text-primary">Кабинет владельца</h1>
        <p className="text-md text-tertiary">
          Вы вошли через Telegram{owner.displayName ? ` как ${owner.displayName}` : ""}.
        </p>
      </header>
      <section aria-labelledby="my-recipes" className="flex flex-col gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="my-recipes" className="font-display text-xl text-primary">
            Мои рецепты
          </h2>
          <AppButton href="/admin/recipes/new">
            Добавить рецепт
          </AppButton>
        </div>
        <RecipeList recipes={recipes} />
      </section>
      <section aria-labelledby="my-articles" className="flex flex-col gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="my-articles" className="font-display text-xl text-primary">
            Мои статьи
          </h2>
          <AppButton href="/admin/articles/new">Новая статья</AppButton>
        </div>
        <ArticleList articles={articles} />
      </section>
      <div className="flex flex-wrap gap-3">
        <AppButton color="secondary" href="/ru">
          На сайт
        </AppButton>
        <AppButton color="secondary" href="/admin/ui">
          Пробные экраны
        </AppButton>
      </div>
      <LogoutForm />
    </main>
  );
}
