import { clearBindingCookie, readBinding, setSessionCookie } from "@/lib/server/auth/cookies";
import { completeLogin } from "@/lib/server/auth/complete-login";
import { getOwner } from "@/lib/server/auth/owner";
import { hashToken } from "@/lib/server/auth/tokens";
import { getAuthConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";

// Вкладка входа спрашивает статус раз в 2 секунды. Ищем попытку только по cookie привязки этого
// браузера; challenge как пропуск не принимается. Подтверждено → новая сессия, привязка удаляется.
const NO_STORE = { "cache-control": "no-store" };

function reply(state: string, code?: string, status = 200): Response {
  return Response.json(code ? { state, code } : { state }, { status, headers: NO_STORE });
}

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return reply("forbidden", undefined, 403);
  const config = getAuthConfig();
  if (!config) return reply("unavailable", undefined, 503);
  try {
    if (await getOwner()) {
      await clearBindingCookie();
      return reply("signed-in");
    }
    const pair = await readBinding();
    if (!pair) return reply("none");
    const result = await completeLogin(hashToken(pair.binding), config.ownerTelegramId);
    if (result.state !== "signed-in") return reply(result.state, result.code);
    await setSessionCookie(result.token, result.expiresAt);
    await clearBindingCookie();
    return reply("signed-in");
  } catch (error) {
    log.error("вход: статус не получен", { reason: error instanceof Error ? error.name : "unknown" });
    return reply("error", undefined, 500);
  }
}
