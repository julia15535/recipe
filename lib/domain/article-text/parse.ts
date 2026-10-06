// Текст статьи + разметка (от ИИ или без ИИ) → блоки и пункты «Проверьте». Разметке ИИ не верим: не легла на
// строки — разбор без ИИ и замечание (ИИ сохранить не мешает, но и слова поменять не может).
import { assemble, marksValid } from "./assemble";
import { ARTICLE_LIMITS, readLines } from "./lines";
import { plainMarks } from "./plain";
import type { ArticleBody, ArticleIssue, Mark } from "./types";

export type ParsedArticle = { ok: boolean; body: ArticleBody; issues: ArticleIssue[]; byAi: boolean };

const AI_FALLBACK = "ИИ разметил текст не по правилам — разобрано без ИИ: заголовки — строки с «#», списки — строки с «-» или «1.».";

export function parseArticle(text: string, aiMarks: readonly Mark[] | null): ParsedArticle {
  const source = readLines(text);
  const fromAi = aiMarks !== null && marksValid(source, aiMarks);
  const marks = fromAi ? aiMarks : plainMarks(source);
  const { body, issues } = assemble(source, marks);
  const all = [...source.issues, ...(aiMarks !== null && !fromAi ? [{ group: "note" as const, text: AI_FALLBACK }] : []), ...issues];
  return { ok: !all.some((issue) => issue.group === "decide"), body, issues: all, byAi: fromAi };
}

/** Название статьи — его пишет владелец (не ИИ). */
export function titleIssue(title: string): ArticleIssue | null {
  const value = title.trim();
  if (!value) return { group: "decide", text: "Напишите название статьи." };
  if (value.length > ARTICLE_LIMITS.title) return { group: "decide", text: `Название длиннее ${ARTICLE_LIMITS.title} знаков — сократите.` };
  return null;
}
