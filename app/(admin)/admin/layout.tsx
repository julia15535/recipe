import type { Metadata } from "next";
import { connection } from "next/server";

import "../../globals.css";
import { AdminRouterProvider } from "@/components/providers/admin-router-provider";
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
        <AdminRouterProvider>{children}</AdminRouterProvider>
      </body>
    </html>
  );
}
