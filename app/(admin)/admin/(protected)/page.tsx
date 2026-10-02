import { AppButton } from "@/components/app-button";
import { requireOwner } from "@/lib/server/auth/owner";

import { LogoutForm } from "./_components/logout-form";

// Кабинет владельца (план owner-login-telegram): пока только вход и выход; рецепты — следующий план.
export default async function AdminPage() {
  const owner = await requireOwner();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-xs text-primary">Кабинет владельца</h1>
        <p className="text-md text-tertiary">
          Вы вошли через Telegram{owner.displayName ? ` как ${owner.displayName}` : ""}.
        </p>
      </header>
      <section aria-labelledby="recipes-soon" className="flex flex-col gap-2 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
        <h2 id="recipes-soon" className="font-display text-xl text-primary">
          Рецепты — скоро
        </h2>
        <p className="text-md text-tertiary">Здесь появятся загрузка рецепта файлом, правка и публикация.</p>
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
