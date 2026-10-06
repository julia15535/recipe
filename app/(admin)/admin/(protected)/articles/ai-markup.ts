import "server-only";

import type { ArticleLines } from "@/lib/domain/article-text/lines";
import type { Mark } from "@/lib/domain/article-text/types";
import { releaseAiTurn, takeAiTurn } from "@/lib/server/ai/one-at-a-time";
import { markupWithAi } from "@/lib/server/ai/article-markup";
import { countArticleImportsLastHour } from "@/lib/server/articles/imports";
import { allow } from "@/lib/server/auth/rate-limit";
import { getAiConfig } from "@/lib/server/env";
import { countImportsLastHour, IMPORTS_PER_HOUR } from "@/lib/server/recipes/imports";

// Разметка статьи ИИ для действия кабинета: один разбор за раз и общий с рецептами лимит разборов в час (в памяти —
// тот же ключ `ai-parse`, в БД — сумма разборов рецептов и статей). Сбой — понятная фраза и «Разобрать без ИИ».
const MESSAGES: Record<string, string> = {
  disabled: "Разметка через ИИ сейчас выключена — нажмите «Разобрать без ИИ».",
  limit: "Слишком много разборов за час — подождите немного или разберите без ИИ.",
  busy: "Предыдущий разбор ещё идёт — подождите несколько секунд.",
  timeout: "ИИ думал слишком долго. Нажмите «Разобрать ещё раз» или «Разобрать без ИИ».",
  auth: "ИИ не принимает наш ключ — напишите мне, я проверю. Пока можно разобрать без ИИ.",
  length: "Статья слишком длинная для одного разбора — сократите текст.",
};
const FALLBACK = "ИИ сейчас не отвечает. Нажмите «Разобрать ещё раз» через минуту или «Разобрать без ИИ».";

export async function aiMarks(source: Pick<ArticleLines, "lines" | "markers">): Promise<{ ok: true; marks: Mark[] } | { ok: false; message: string }> {
  const config = getAiConfig();
  if (!config) return { ok: false, message: MESSAGES.disabled ?? FALLBACK };
  if (!takeAiTurn()) return { ok: false, message: MESSAGES.busy ?? FALLBACK };
  try {
    const used = (await countImportsLastHour()) + (await countArticleImportsLastHour());
    if (used >= IMPORTS_PER_HOUR || !allow("ai-parse", IMPORTS_PER_HOUR, 60 * 60 * 1000)) return { ok: false, message: MESSAGES.limit ?? FALLBACK };
    const answer = await markupWithAi(source, config);
    return answer.ok ? answer : { ok: false, message: MESSAGES[answer.reason] ?? FALLBACK };
  } finally {
    releaseAiTurn();
  }
}
