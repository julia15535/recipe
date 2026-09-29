"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";

// Ссылки в админке: без локалей, обычный роутер Next.
export function AdminRouterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={(href) => router.push(href)}>{children}</RouterProvider>;
}
