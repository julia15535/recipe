"use client";

import { useLocale } from "next-intl";
import { useRouter as useNextRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";

import { getPathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Ссылки компонентов React Aria (кнопки с href) в публичной части: адрес сразу с префиксом локали —
// верный и до загрузки JS, и при открытии в новой вкладке. Путь, где локаль уже указана (переключатель
// языка), и внешние адреса не трогаем.
const WITH_LOCALE = new RegExp(`^/(${routing.locales.join("|")})(?=/|\\?|#|$)`);
const EXTERNAL = /^([a-z][a-z\d+.-]*:|\/\/)/i;

export function PublicRouterProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const intlRouter = useRouter();
  const nextRouter = useNextRouter();
  return (
    <RouterProvider
      navigate={(href) => (WITH_LOCALE.test(href) ? nextRouter.push(href) : intlRouter.push(href))}
      useHref={(href) => (EXTERNAL.test(href) || WITH_LOCALE.test(href) ? href : getPathname({ href, locale }))}
    >
      {children}
    </RouterProvider>
  );
}
