import "./globals.css";
import { AppButton } from "@/components/app-button";
import { fontVariables } from "@/styles/fonts";

// Запасная 404 для путей мимо proxy (с расширением, /api/…): у неё свой <html>, общего root layout нет.
// Остальные неизвестные пути (например, /fr → /ru/fr) получают локализованную 404.
export default function RootNotFound() {
  return (
    <html lang="ru" className={fontVariables}>
      <body>
        <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
          <h1 className="font-display text-display-xs text-primary">Страница не найдена</h1>
          <AppButton href="/ru" className="self-start">
            На главную
          </AppButton>
        </main>
      </body>
    </html>
  );
}
