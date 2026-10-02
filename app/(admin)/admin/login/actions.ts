"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { findActiveByBinding, LOGIN_LIMITS, startChallenge } from "@/lib/server/auth/challenge";
import { readBinding, setBindingCookie } from "@/lib/server/auth/cookies";
import { getOwner } from "@/lib/server/auth/owner";
import { allow } from "@/lib/server/auth/rate-limit";
import { clientIp, hashToken, ipHash } from "@/lib/server/auth/tokens";
import { getAuthConfig } from "@/lib/server/env";

import type { LoginNotice } from "./_components/login-notices";

export type StartLoginState = { notice: LoginNotice } | null;

/**
 * «Войти через Telegram» — только POST (Server Action: Next сверяет Origin). Живая попытка этого
 * браузера переиспользуется (вторая вкладка видит тот же код); «Начать заново» (restart=1)
 * отменяет её и создаёт новую. Успех — страница перерисовывается с кодом; отказ — сообщение.
 */
export async function startLogin(_previous: StartLoginState, formData: FormData): Promise<StartLoginState> {
  const config = getAuthConfig();
  if (!config) return { notice: "unavailable" };
  if (await getOwner()) redirect("/admin");
  const requestHeaders = await headers();
  const fetchSite = requestHeaders.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return null;
  // Поток POST с одного адреса отсекаем в памяти, до запросов к БД.
  if (!allow(`login:${clientIp(requestHeaders)}`, LOGIN_LIMITS.perIp, 10 * 60 * 1000)) return { notice: "limit" };

  const current = await readBinding();
  const previousBindingHash = current ? hashToken(current.binding) : null;
  const restart = formData.get("restart") === "1";
  if (!previousBindingHash || restart || !(await findActiveByBinding(previousBindingHash))) {
    const result = await startChallenge({ ipHash: ipHash(requestHeaders, config.webhookSecret), previousBindingHash });
    if (!result.ok) return { notice: "limit" };
    await setBindingCookie(result.binding, result.challenge, result.expiresAt);
  }
  refresh();
  return null;
}
