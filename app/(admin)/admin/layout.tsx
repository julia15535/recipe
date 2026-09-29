import type { Metadata } from "next";

import "../../globals.css";
import { AdminRouterProvider } from "@/components/providers/admin-router-provider";
import { fontVariables } from "@/styles/fonts";

// Корневой layout админки: только русский, вне локалей, закрыт от индексации (ADR-0011).
export const metadata: Metadata = {
  title: "Кабинет владельца · Книга рецептов",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="ru" className={fontVariables}>
      <body>
        <AdminRouterProvider>{children}</AdminRouterProvider>
      </body>
    </html>
  );
}
