import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";

// Next 16: proxy.ts вместо middleware.ts — один на приложение, поэтому ветки собираем здесь явно.
// Публичные пути → next-intl (префикс локали, язык из cookie/Accept-Language, иначе /ru).
// /admin → мимо локалей, со строгой CSP на nonce. Авторизацию proxy НЕ делает: её проверяет
// серверный слой у данных (requireOwner, lib/server/auth/owner.ts). Здесь — только «оптимистичное»
// перенаправление без cookie сессии: честный 307 на вход вместо перехода уже в браузере.
const LOGIN_PATH = "/admin/login";
const SESSION_COOKIE = "__Host-owner_session";
const handleI18nRouting = createMiddleware(routing);

/**
 * CSP кабинета: скрипты — только с nonce этого запроса (Next ставит его сам, читая заголовок
 * запроса); стили inline разрешены — React и React Aria пишут style-атрибуты, а Safari не знает
 * style-src-attr. Внешних источников нет.
 */
function adminCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function withAdminCsp(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = adminCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname !== LOGIN_PATH && !request.cookies.has(SESSION_COOKIE)) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    return withAdminCsp(request);
  }
  return handleI18nRouting(request);
}

export const config = {
  // Мимо proxy: API, служебные пути Next и файлы с расширением (robots.txt, favicon.ico, …);
  // /admin — всегда через proxy (CSP и 307), даже с точкой в адресе.
  matcher: ["/admin", "/admin/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
