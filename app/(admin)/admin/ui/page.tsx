import type { Metadata } from "next";

import { AppButton } from "@/components/app-button";

import { PROTOTYPE } from "./_demo/demo-catalog";

export const metadata: Metadata = { title: "Пробные экраны · Книга рецептов" };

const SCREENS = [
  { href: PROTOTYPE.home, title: "Главная", text: "Лупа-поиск в шапке, каталог первым: лента на компьютере, список снизу на телефоне." },
  { href: PROTOTYPE.search, title: "Поиск", text: "«По рецепту / По ингредиенту», уточнение разделом и особенностями состава." },
  { href: PROTOTYPE.recipe("syrniki"), title: "Рецепт", text: "Впишите своё количество основного ингредиента — остальное пересчитается." },
];

// Список пробных экранов (план home-and-recipe-screens): владелец смотрит их с телефона и компьютера
// до того, как они появятся на настоящем сайте. Закрыто от поисковиков; паролем — когда появится вход.
export default function PrototypesIndexPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wide text-brand-secondary uppercase">Пробные экраны</p>
        <h1 className="font-display text-display-sm text-primary">Книга рецептов</h1>
        <p className="text-md text-tertiary">Рецепты примерные. Олива и персик на кремовом фоне, заголовки Prata, текст Manrope.</p>
      </header>
      <ul className="flex flex-col gap-4">
        {SCREENS.map((screen) => (
          <li key={screen.href} className="flex flex-col gap-3 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
            <h2 className="font-display text-xl text-primary">{screen.title}</h2>
            <p className="text-md text-tertiary">{screen.text}</p>
            <AppButton href={screen.href} className="self-start">
              Открыть
            </AppButton>
          </li>
        ))}
      </ul>
    </main>
  );
}
