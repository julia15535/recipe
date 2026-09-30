import { AppButton } from "@/components/app-button";

import { candidateFontVariables } from "./candidate-fonts";
import { HeadingFontScope, HeadingFontSwitch } from "./heading-font-scope";
import { PreviewCards } from "./preview-cards";
import { PreviewRecipe } from "./preview-recipe";
import { PreviewSearch } from "./preview-search";

// Пробная страница дизайна (план design-system-uui): владелец смотрит на телефоне и выбирает шрифт заголовков.
export function DesignPreview() {
  return (
    <HeadingFontScope className={candidateFontVariables}>
      <main className="mx-auto flex w-full max-w-screen-sm flex-col gap-6 px-4 pt-6 pb-32">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold tracking-wide text-brand-secondary uppercase">Проба дизайна</p>
          <h1 className="font-display text-display-sm font-semibold text-primary">Книга рецептов</h1>
          <p className="text-md text-tertiary">
            Олива, персик и кремовый фон. Переключите шрифт заголовков и посмотрите, как выглядят поиск, карточки и рецепт.
          </p>
          <HeadingFontSwitch />
        </header>

        <PreviewSearch />

        <section className="flex flex-col gap-2 rounded-2xl bg-accent-100 p-4">
          <p className="text-sm font-semibold tracking-wide text-accent-700 uppercase">Подборка недели</p>
          <p className="font-display text-xl font-semibold text-primary">Тёплые супы на осень</p>
        </section>

        <PreviewCards />
        <PreviewRecipe />
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-secondary bg-primary/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-screen-sm">
          <AppButton className="w-full">Готовлю по этому рецепту</AppButton>
        </div>
      </div>
    </HeadingFontScope>
  );
}
