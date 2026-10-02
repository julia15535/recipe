import type { ReactNode } from "react";

import { requireOwner } from "@/lib/server/auth/owner";

// Закрытая часть кабинета: без сессии — на /admin/login. Это только перенаправление; данные
// и действия проверяют владельца сами (requireOwner в каждой странице и Server Action).
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireOwner();
  return children;
}
