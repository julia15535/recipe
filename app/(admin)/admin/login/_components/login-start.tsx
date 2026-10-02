import { AppButton } from "@/components/app-button";

import { LOGIN_NOTICES } from "./login-notices";
import { StartLoginForm } from "./start-login-form";

/** Первый экран входа: страница ничего не создаёт, пока не нажата кнопка (POST). */
export function LoginStart({ available }: { available: boolean }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-xs text-primary">Вход в кабинет</h1>
        <p className="text-md text-tertiary">
          Кабинет — только для автора книги рецептов. Входите через свой Telegram: пароль не нужен.
        </p>
      </header>
      {available ? <StartLoginForm /> : <p className="text-md text-tertiary">{LOGIN_NOTICES.unavailable}</p>}
      <AppButton color="secondary" href="/ru" className="self-start">
        На сайт
      </AppButton>
    </>
  );
}
