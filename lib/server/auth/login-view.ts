import "server-only";

import { findActiveByBinding } from "./challenge";
import { readBinding } from "./cookies";
import { hashToken } from "./tokens";

export type WaitingView = { code: string; link: string };

/** Попытка входа этого браузера, если она ещё жива: код для глаз и ссылка на бота. */
export async function loadWaiting(botUsername: string): Promise<WaitingView | null> {
  const pair = await readBinding();
  if (!pair) return null;
  const active = await findActiveByBinding(hashToken(pair.binding));
  if (!active || !active.challengeHash.equals(hashToken(pair.challenge))) return null;
  return { code: active.code, link: `https://t.me/${botUsername}?start=${pair.challenge}` };
}
