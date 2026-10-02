import "server-only";
import { cookies } from "next/headers";

import { TOKEN_PATTERN } from "./tokens";

// __Host-: только HTTPS, без Domain, Path=/ — cookie не подменить с поддомена.
export const SESSION_COOKIE = "__Host-owner_session";
export const BINDING_COOKIE = "__Host-login_binding";
const BASE = { httpOnly: true, secure: true, path: "/" } as const;

export async function readSessionToken(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && TOKEN_PATTERN.test(value) ? value : null;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { ...BASE, sameSite: "lax", expires: expiresAt });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...BASE, sameSite: "lax", maxAge: 0 });
}

/**
 * Привязка попытки входа к браузеру: «привязка.challenge». По привязке страница узнаёт статус,
 * challenge нужен только для ссылки на бота (в БД оба — хешами). SameSite=Strict: с чужого сайта
 * не уходит.
 */
export async function readBinding(): Promise<{ binding: string; challenge: string } | null> {
  const [binding = "", challenge = "", extra] = ((await cookies()).get(BINDING_COOKIE)?.value ?? "").split(".");
  if (extra !== undefined || !TOKEN_PATTERN.test(binding) || !TOKEN_PATTERN.test(challenge)) return null;
  return { binding, challenge };
}

export async function setBindingCookie(binding: string, challenge: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(BINDING_COOKIE, `${binding}.${challenge}`, { ...BASE, sameSite: "strict", expires: expiresAt });
}

export async function clearBindingCookie(): Promise<void> {
  (await cookies()).set(BINDING_COOKIE, "", { ...BASE, sameSite: "strict", maxAge: 0 });
}
