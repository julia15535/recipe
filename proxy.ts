import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";

// Next 16: proxy.ts вместо middleware.ts — один на приложение, поэтому ветки собираем здесь явно.
// Публичные пути → next-intl (префикс локали, язык из cookie/Accept-Language, иначе /ru).
// /admin → мимо локалей (позже — продление сессии, как в sup2). Авторизацию проверяет серверный
// слой у данных, не proxy.
const handleI18nRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return NextResponse.next();
  return handleI18nRouting(request);
}

export const config = {
  // Мимо proxy: API, служебные пути Next и файлы с расширением (robots.txt, favicon.ico, …).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
