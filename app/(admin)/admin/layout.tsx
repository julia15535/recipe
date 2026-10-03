import type { Metadata } from "next";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";

import "../../globals.css";
import { AdminRouterProvider } from "@/components/providers/admin-router-provider";
import { clientMessages } from "@/i18n/client-messages";
import { fontVariables } from "@/styles/fonts";

// Корневой layout админки: только русский, вне локалей, закрыт от индексации (ADR-0011).
export const metadata: Metadata = {
  title: "Кабинет владельца · Книга рецептов",
  robots: { index: false, follow: false },
};

// CSP с nonce (proxy.ts) работает только при рендере на каждый запрос: статическая оболочка (PPR)
// nonce не получит. Поэтому весь /admin — полностью динамический, без проверки «мгновенной» оболочки.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  return (
    <html lang="ru" className={fontVariables}>
      <body>
        {/* Общие компоненты рецепта и поиска берут надписи из словаря — кабинету нужен русский (ADR-0029). */}
        <NextIntlClientProvider locale="ru" messages={await clientMessages()}>
          <AdminRouterProvider>{children}</AdminRouterProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
