"use server";

import { redirect } from "next/navigation";

import { clearSessionCookie } from "@/lib/server/auth/cookies";
import { LOGIN_PATH, requireOwner } from "@/lib/server/auth/owner";
import { revokeSession } from "@/lib/server/auth/session";

// Выход — только POST (Server Action, Next сверяет Origin); сессия отзывается в БД.
export async function logout(): Promise<void> {
  const owner = await requireOwner();
  await revokeSession(owner.sessionId);
  await clearSessionCookie();
  redirect(LOGIN_PATH);
}
