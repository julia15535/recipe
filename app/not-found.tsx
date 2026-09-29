import Link from "next/link";

import "./globals.css";
import { buttonVariants } from "@/components/ui/button";

// Запасная 404 для путей вне локалей (например, /fr): у неё свой <html>, общего root layout нет.
export default function RootNotFound() {
  return (
    <html lang="ru">
      <body>
        <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
          <h1 className="text-2xl font-semibold">Страница не найдена</h1>
          <Link href="/ru" className={buttonVariants({ className: "h-11 self-start px-4 text-base" })}>
            На главную
          </Link>
        </main>
      </body>
    </html>
  );
}
