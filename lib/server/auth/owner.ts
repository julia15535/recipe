import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuthConfig } from "@/lib/server/env";

import { readSessionToken } from "./cookies";
import { findSession, type OwnerSession } from "./session";

export const LOGIN_PATH = "/admin/login";

/** Владелец текущего запроса или null. Один запрос к БД на рендер (React cache). */
export const getOwner = cache(async (): Promise<OwnerSession | null> => {
  const config = getAuthConfig();
  const token = await readSessionToken();
  if (!config || !token) return null;
  return findSession(token, config.ownerTelegramId);
});

/**
 * Проверка у данных (DAL): вызывать в каждой закрытой странице и в каждом действии.
 * Layout `(protected)` только перенаправляет — на него одного полагаться нельзя.
 */
export async function requireOwner(): Promise<OwnerSession> {
  const owner = await getOwner();
  if (!owner) redirect(LOGIN_PATH);
  return owner;
}
