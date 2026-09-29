"use client";

import "./globals.css";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ru">
      <body>
        <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
          <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 self-start rounded-lg bg-primary px-4 text-base text-primary-foreground"
          >
            Попробовать снова
          </button>
        </main>
      </body>
    </html>
  );
}
