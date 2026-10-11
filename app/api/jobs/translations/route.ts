import { timingSafeEqual } from "node:crypto";

import { pickupArticleTranslations } from "@/lib/server/articles/translation-run";
import { pickupTranslations } from "@/lib/server/recipes/translation-run";
import { jobsSecret } from "@/lib/server/jobs-secret";

// Подборщик переводов рецептов (ADR-0029) и статей (ADR-0038): вызывает только сам процесс сайта раз в минуту (instrumentation-node.ts) с секретом
// процесса — через свой адрес, чтобы сброс кэша шёл в контексте запроса Next. Снаружи — 404. Среда — Node (по
// умолчанию; `runtime` с cacheComponents задавать нельзя).

export async function POST(request: Request) {
  const secret = jobsSecret();
  const given = Buffer.from(request.headers.get("x-jobs-secret") ?? "");
  const expected = Buffer.from(secret ?? "");
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response(null, { status: 404 });
  const started = Date.now();
  await pickupTranslations();
  await pickupArticleTranslations(started);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
