"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ArticleView } from "@/components/article/view";
import { marksOf } from "@/lib/domain/article-text/assemble";
import { remap } from "@/lib/domain/article-text/edit";
import { ARTICLE_LIMITS, byteLength, markerLine, normalizeText, readLines } from "@/lib/domain/article-text/lines";
import { parseArticle, titleIssue } from "@/lib/domain/article-text/parse";
import type { ArticleIssue } from "@/lib/domain/article-text/types";
import { dropArticleImport, loadArticleImport, storeArticleImport } from "@/lib/server/articles/imports";
import { getArticle, photoKeys } from "@/lib/server/articles/queries";
import { createArticle, deleteArticleDraft, replaceArticle, setArticleRecipes, setArticleStatus } from "@/lib/server/articles/save";
import { storableIssue } from "@/lib/server/articles/storable";
import { toArticleView } from "@/lib/server/articles/view";
import { requireOwner } from "@/lib/server/auth/owner";
import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";
import { refreshPublicSite } from "@/lib/server/recipes/public-cache";
import { listRecipes } from "@/lib/server/recipes/queries";

import { aiMarks } from "./ai-markup";

// Действия кабинета со статьями (план articles, ADR-0034). Каждое — requireOwner(). «Разобрать» хранит текст и
// разметку на сервере (`article_imports`); «Сохранить» берёт их по id и собирает блоки заново — блокам и меткам из
// браузера не верим. Слова не менялись (перенесли метку фото) — прежняя разметка переносится без ИИ.
export type ArticleParsed = { ok: true; importId: string; ready: boolean; issues: ArticleIssue[]; view: ArticleView } | { ok: false; message: string };
export type ArticleSaved = { ok: true; id: string } | { ok: false; message: string };

const parseInput = z.object({ title: z.string().max(400).catch(""), text: z.string().catch(""), articleId: z.uuid().nullable(), ai: z.boolean() });
const STORAGE = "Не получилось сохранить — попробуйте ещё раз. Текст на месте.";

/** Метки только на фото этой статьи (у новой статьи фото ещё нет). */
const unknownKeys = (text: string, keys: ReadonlySet<string>): ArticleIssue[] =>
  [...readLines(text).markers.values()]
    .filter((key) => !keys.has(key))
    .map((key) => ({ group: "decide", text: `Фото «[Фото ${key}]» нет у статьи — уберите эту строку.` }));

/** Фото статьи, метки которых нет в тексте: на сайте их не будет — предупреждаем до «Сохранить». */
const unplacedNotes = (text: string, keys: ReadonlySet<string>): ArticleIssue[] => {
  const used = new Set(readLines(text).markers.values());
  return [...keys]
    .filter((key) => !used.has(key))
    .map((key) => ({ group: "note", text: `Фото «${markerLine(key)}» без места — его метки нет в тексте, на сайте его не будет. Вернуть — вставьте эту строку в текст; убрать — кнопкой на странице статьи.` }));
};

export async function parseArticleText(input: z.input<typeof parseInput>): Promise<ArticleParsed> {
  await requireOwner();
  const fields = parseInput.parse(input);
  const text = normalizeText(fields.text.replaceAll("\u0000", ""));
  // Размер — до ИИ: слишком длинный текст ИИ не отправляем и не храним (verify 06.10).
  if (text.trim() === "") return { ok: false, message: "Вставьте текст статьи." };
  if (byteLength(text) > ARTICLE_LIMITS.bytes) return { ok: false, message: "Текст длиннее 20 КБ — сократите статью." };
  const source = readLines(text);
  if (source.lines.length > ARTICLE_LIMITS.lines) return { ok: false, message: `В тексте больше ${ARTICLE_LIMITS.lines} строк — сократите статью.` };
  try {
    const stored = fields.articleId ? await getArticle(fields.articleId) : null;
    if (fields.articleId && !stored) return { ok: false, message: "Статья не найдена — возможно, её удалили." };
    const keys = new Set(stored?.photos.keys() ?? []);
    const wrongMarkers = [...source.issues, ...unknownKeys(text, keys)].some((issue) => issue.group === "decide");
    const moved = stored ? remap(stored.sourceText, stored.body, text) : { ok: false as const };
    let marks = moved.ok ? marksOf(moved.body) : null;
    // С ошибками в метках ИИ не зовём — сначала их исправить (запрос не тратится).
    if (!marks && fields.ai && !wrongMarkers) {
      const answer = await aiMarks(source);
      if (!answer.ok) return answer;
      marks = answer.marks;
    }
    const parsed = parseArticle(text, marks);
    const title = titleIssue(fields.title);
    const size = parsed.ok ? storableIssue(text, parsed.body) : null;
    const issues = [...(title ? [title] : []), ...(size ? [size] : []), ...unknownKeys(text, keys), ...parsed.issues, ...unplacedNotes(text, keys)];
    const importId = await storeArticleImport(text, parsed.marks);
    const view = toArticleView(fields.title.trim() || "Без названия", parsed.body, stored?.photos ?? new Map(), []);
    return { ok: true, importId, ready: !issues.some((issue) => issue.group === "decide"), issues, view };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("статья: разбор не сохранён", { pg: error.code });
    return { ok: false, message: "Не получилось сохранить разбор — нажмите ещё раз. Текст на месте." };
  }
}

const saveInput = z.object({
  importId: z.uuid(),
  title: z.string().max(400),
  publish: z.boolean(),
  target: z.object({ id: z.uuid(), revision: z.number().int().positive() }).nullable(),
});

export async function saveArticle(input: z.input<typeof saveInput>): Promise<ArticleSaved> {
  await requireOwner();
  const fields = saveInput.safeParse(input);
  if (!fields.success) return { ok: false, message: "Не получилось сохранить — разберите статью ещё раз." };
  const { importId, title, publish, target } = fields.data;
  try {
    const stored = await loadArticleImport(importId);
    if (!stored) return { ok: false, message: "Разбор устарел — нажмите «Разобрать» ещё раз." };
    const parsed = parseArticle(stored.sourceText, stored.marks);
    const keys = target ? await photoKeys(target.id) : new Set<string>();
    if (!parsed.ok || titleIssue(title) || unknownKeys(stored.sourceText, keys).length || storableIssue(stored.sourceText, parsed.body)) {
      return { ok: false, message: "Сначала решите пункты «Нужно решить» и разберите заново." };
    }
    const draft = { title, sourceText: stored.sourceText, body: parsed.body };
    const saved = target ? await replaceArticle(target.id, target.revision, draft) : await createArticle(draft, publish ? "published" : "draft");
    if (!saved.ok) {
      return { ok: false, message: saved.reason === "conflict" ? "Статья уже изменена в другой вкладке — обновите страницу." : "Статья не найдена." };
    }
    refreshPublicSite();
    await dropArticleImport(importId); // разбор одноразовый: второе нажатие не создаст дубль
    return { ok: true, id: saved.id };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("статья не сохранена", { pg: error.code });
    return { ok: false, message: STORAGE };
  }
}

const statusForm = z.object({ id: z.uuid(), status: z.enum(["draft", "published"]) });

export async function changeArticleStatus(form: FormData): Promise<void> {
  await requireOwner();
  const { id, status } = statusForm.parse({ id: form.get("id"), status: form.get("status") });
  await setArticleStatus(id, status);
  refreshPublicSite();
  refresh();
}

export async function removeArticleDraft(form: FormData): Promise<void> {
  await requireOwner();
  await deleteArticleDraft(z.uuid().parse(form.get("id")));
  refreshPublicSite();
  redirect("/admin");
}

const relatedInput = z.object({ articleId: z.uuid(), revision: z.number().int().positive(), recipeIds: z.array(z.uuid()).max(20) });

/** Связанные рецепты: только существующие рецепты владельца, порядок — как выбраны. */
export async function saveRelatedRecipes(input: z.input<typeof relatedInput>): Promise<ArticleSaved> {
  await requireOwner();
  const fields = relatedInput.safeParse(input);
  if (!fields.success) return { ok: false, message: "Можно выбрать до 20 рецептов." };
  try {
    const known = new Set((await listRecipes()).map((recipe) => recipe.id));
    const ids = fields.data.recipeIds.filter((recipeId) => known.has(recipeId));
    const saved = await setArticleRecipes(fields.data.articleId, fields.data.revision, ids);
    if (!saved.ok) return { ok: false, message: saved.reason === "conflict" ? "Статья уже изменена в другой вкладке — обновите страницу." : "Статья не найдена." };
    refreshPublicSite();
    refresh();
    return { ok: true, id: saved.id };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("статья: связи не сохранены", { pg: error.code });
    return { ok: false, message: "Не получилось сохранить — попробуйте ещё раз." };
  }
}
