// Перевод статьи (план articles-en, ADR-0038): статья → плоский список единиц для ИИ и обратно. Структура (заголовок,
// абзац, пункт, номер списка, места фото) — из русского снимка, ИИ переводит только тексты. Жирный и курсив (ADR-0037)
// уходят ИИ метками ⟪b⟫…⟪/b⟫, ⟪i⟫…⟪/i⟫, одиночная звёздочка — ⟪*⟫: последовательность меток в ответе обязана совпасть.
// Заголовки и подписи — без оформления (на сайте его там нет). Числа маскирует сервер (`maskNumbers`), как у рецептов.
import { inlineRuns, plainText, type Run } from "./inline";
import type { ArticleBlock, ArticleBody } from "./types";

export type Unit = { id: string; text: string };
export type ArticleSource = { title: string; body: ArticleBody; captions: Record<string, string> };
export type TranslatedArticle = { title: string; body: ArticleBody; captions: Record<string, string> };

const TAG = /⟪(\/?[bi]|\*)⟫/gu;
type Flag = "b" | "i";

const flagsOf = (run: Run): Flag[] => [...(run.bold ? ["b" as const] : []), ...(run.italic ? ["i" as const] : [])];

/** Какие выделения открыть у куска `index`: сначала то, что продлится дольше, — оно снаружи, и его не придётся
 * закрывать и открывать заново (иначе знаки слиплись бы: «**» + «*» → «***»). */
function opening(runs: Run[], index: number, open: Flag[]): Flag[] {
  const span = (flag: Flag) => {
    let length = 0;
    while (runs[index + length] && flagsOf(runs[index + length] as Run).includes(flag)) length += 1;
    return length;
  };
  return flagsOf(runs[index] as Run)
    .filter((flag) => !open.includes(flag))
    .sort((a, b) => span(b) - span(a));
}

/** Звёздочки → метки. */
export function toTagged(text: string): string {
  let out = "";
  const open: Flag[] = [];
  const runs = inlineRuns(text);
  for (const [index, run] of runs.entries()) {
    const want = flagsOf(run);
    while (open.some((tag) => !want.includes(tag))) out += `⟪/${open.pop()}⟫`;
    for (const tag of opening(runs, index, open)) {
      open.push(tag);
      out += `⟪${tag}⟫`;
    }
    out += run.text.replaceAll("*", "⟪*⟫");
  }
  while (open.length) out += `⟪/${open.pop()}⟫`;
  return out;
}

export const tagSequence = (text: string): string[] => [...text.matchAll(TAG)].map((match) => match[1] ?? "");

/** Метки → куски с оформлением; null — метки перепутаны (закрыта не та, не закрыта). */
function taggedRuns(text: string): Run[] | null {
  const runs: Run[] = [];
  const open: string[] = [];
  let at = 0;
  const push = (value: string) => {
    if (!value) return;
    const run = { text: value, bold: open.includes("b"), italic: open.includes("i") };
    const last = runs.at(-1);
    if (last && last.bold === run.bold && last.italic === run.italic) last.text += value;
    else runs.push(run);
  };
  for (const match of text.matchAll(TAG)) {
    push(text.slice(at, match.index));
    at = (match.index ?? 0) + match[0].length;
    const tag = match[1] ?? "";
    if (tag === "*") push("*");
    else if (tag.startsWith("/")) {
      if (open.pop() !== tag.slice(1)) return null;
    } else if (open.includes(tag)) return null;
    else open.push(tag);
  }
  push(text.slice(at));
  return open.length ? null : runs;
}

// Тот же текст и то же оформление у каждой буквы (у пробелов оформление не видно — не сравниваем).
const same = (a: Run[], b: Run[]) => {
  const letters = (runs: Run[]) => runs.flatMap((run) => [...run.text].map((char) => (/\s/u.test(char) ? char : `${char}${run.bold ? "b" : ""}${run.italic ? "i" : ""}`))).join("|");
  return letters(a) === letters(b);
};

/**
 * Метки → звёздочки (`\*` — одиночная звёздочка). Пробелы по краям выделения выносятся наружу («⟪b⟫ word⟪/b⟫» —
 * обычная ошибка перевода). Если звёздочки разбираются не так, как задумано, — текст без оформления (слова важнее).
 * null — метки перепутаны.
 */
export function fromTagged(text: string): string | null {
  const parsed = taggedRuns(text);
  if (!parsed) return null;
  const runs: Run[] = parsed.flatMap((run, index) => {
    if (!run.bold && !run.italic) return [run];
    const [, lead = "", core = "", tail = ""] = /^(\s*)([\s\S]*?)(\s*)$/u.exec(run.text) ?? [];
    // Снаружи уже есть пробел — вынесенный не добавляем («Add ⟪b⟫ salt ⟪/b⟫ last» → «Add **salt** last»).
    const before = /\s$/u.test(parsed[index - 1]?.text ?? "") ? "" : lead;
    const after = /^\s/u.test(parsed[index + 1]?.text ?? "") ? "" : tail;
    // Вынесенный пробел берёт общее с соседом оформление: внутри курсива он остаётся курсивом и не рвёт выделение.
    const shared = (other: Run | undefined) => ({ bold: run.bold && Boolean(other?.bold), italic: run.italic && Boolean(other?.italic) });
    const parts: Run[] = [];
    if (before) parts.push({ text: before, ...shared(parsed[index - 1]) });
    if (core) parts.push({ ...run, text: core });
    if (after) parts.push({ text: after, ...shared(parsed[index + 1]) });
    return parts;
  });
  let out = "";
  const open: Flag[] = [];
  const mark = (tag: Flag) => (tag === "b" ? "**" : "*");
  for (const [index, run] of runs.entries()) {
    const want = flagsOf(run);
    while (open.some((tag) => !want.includes(tag))) out += mark(open.pop() ?? "i");
    for (const tag of opening(runs, index, open)) {
      open.push(tag);
      out += mark(tag);
    }
    out += run.text.replaceAll("*", "\\*");
  }
  while (open.length) out += mark(open.pop() ?? "i");
  return same(inlineRuns(out), runs) ? out : runs.map((run) => run.text.replaceAll("*", "\\*")).join("");
}

/** Единицы перевода: название, заголовки и абзацы по id блока, пункты — `b4:0`, подписи фото — `photo:KEY`. */
export function articleUnits(source: ArticleSource): Unit[] {
  const units: Unit[] = [{ id: "title", text: source.title }];
  for (const block of source.body.blocks) {
    if (block.type === "heading") units.push({ id: block.id, text: plainText(block.text) });
    if (block.type === "paragraph") units.push({ id: block.id, text: toTagged(block.text) });
    if (block.type === "list") block.items.forEach((item, index) => units.push({ id: `${block.id}:${index}`, text: toTagged(item.text) }));
    const caption = block.type === "photo" ? source.captions[block.key] : undefined;
    if (block.type === "photo" && caption) units.push({ id: `photo:${block.key}`, text: plainText(caption) });
  }
  return units;
}

export type ComposeFailure = "structure" | "formatting";

/** Ответ ИИ (тексты по тем же id и в том же порядке, числа уже на месте) → английская статья той же структуры. */
export function composeArticle(source: ArticleSource, translated: readonly Unit[]): { ok: true; article: TranslatedArticle } | { ok: false; reason: ComposeFailure } {
  const units = articleUnits(source);
  if (translated.length !== units.length || units.some((unit, index) => translated[index]?.id !== unit.id || !translated[index]?.text.trim())) {
    return { ok: false, reason: "structure" };
  }
  const text = new Map<string, string>();
  for (const [index, unit] of units.entries()) {
    const value = (translated[index]?.text ?? "").trim();
    if (tagSequence(value).join() !== tagSequence(unit.text).join()) return { ok: false, reason: "formatting" };
    const stars = fromTagged(value);
    if (stars === null) return { ok: false, reason: "formatting" };
    text.set(unit.id, stars);
  }
  const get = (id: string) => text.get(id) ?? "";
  const blocks = source.body.blocks.map((block): ArticleBlock => {
    if (block.type === "heading" || block.type === "paragraph") return { ...block, text: get(block.id) };
    if (block.type === "list") return { ...block, items: block.items.map((item, index) => ({ ...item, text: get(`${block.id}:${index}`) })) };
    return block;
  });
  const captions = Object.fromEntries(Object.keys(source.captions).flatMap((key) => (text.has(`photo:${key}`) ? [[key, get(`photo:${key}`)]] : [])));
  return { ok: true, article: { title: get("title"), body: { ...source.body, blocks }, captions } };
}
