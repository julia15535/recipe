"use client";

import "./globals.css";
import { AppButton } from "@/components/app-button";
import { fontVariables } from "@/styles/fonts";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ru" className={fontVariables}>
      <body>
        <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
          <h1 className="font-display text-display-xs font-semibold text-primary">Что-то пошло не так</h1>
          <AppButton className="self-start" onPress={() => retry()}>
            Попробовать снова
          </AppButton>
        </main>
      </body>
    </html>
  );
}
