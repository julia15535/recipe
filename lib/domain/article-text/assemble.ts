// Разметка строк → блоки статьи. Текст блока — из строк автора (перенос внутри абзаца — пробел); убираются только
// служебные начала строк: «#» у заголовка, «-», «•», «1.» у пункта списка (пункт из одного значка не выводится). Фото — по меткам. Разметку (от ИИ или
// без ИИ) проверяем: каждая строка с текстом — ровно в одной записи, по порядку, без пустых строк и меток внутри.
import { ARTICLE_LIMITS, type ArticleLines, contentLines } from "./lines";
import { ARTICLE_SCHEMA_VERSION, type ArticleBlock, type ArticleBody, type ArticleIssue, type Mark } from "./types";

export const HEADING_PREFIX = /^\s*#{1,6}\s+/u;
// Значок пункта: «-», «•», «*»… Длинное тире «—» в начале строки — реплика диалога, не пункт (его не убираем).
export const BULLET_PREFIX = /^\s*[-•*●▪](?:\s+|$)/u;
export const NUMBER_PREFIX = /^\s*\d{1,3}[.)](?:\s+|$)/u;

/** Разметка закрывает каждую строку с текстом ровно один раз, по порядку; заголовок — одна строка. */
export function marksValid(source: Pick<ArticleLines, "lines" | "markers">, marks: readonly Mark[]): boolean {
  const content = contentLines(source);
  const covered: number[] = [];
  let last = -1;
  for (const mark of marks) {
    if (!Number.isInteger(mark.from) || !Number.isInteger(mark.to) || mark.from > mark.to || mark.from <= last) return false;
    if ((mark.kind === "h2" || mark.kind === "h3") && mark.from !== mark.to) return false;
    for (let line = mark.from; line <= mark.to; line += 1) covered.push(line);
    last = mark.to;
  }
  return covered.length === content.length && covered.every((line, index) => line === content[index]);
}

const join = (lines: readonly string[]) =>
  lines
    .map((line) => line.trim())
    .join(" ")
    .replace(/\s+/gu, " ");

/** Блоки по проверенной разметке; подряд идущие пункты одного вида — один список, фото между ними его делит. */
export function assemble(source: Pick<ArticleLines, "lines" | "markers">, marks: readonly Mark[]): { body: ArticleBody; issues: ArticleIssue[] } {
  const { lines, markers } = source;
  const issues: ArticleIssue[] = [];
  const blocks: ArticleBlock[] = [];
  const id = () => `b${blocks.length + 1}`;
  const events = [
    ...marks.map((mark) => ({ at: mark.from, mark })),
    ...[...markers].map(([line, key]) => ({ at: line, key })),
  ].sort((a, b) => a.at - b.at);
  for (const event of events) {
    if ("key" in event) {
      blocks.push({ id: id(), type: "photo", key: event.key, line: event.at });
      continue;
    }
    const { kind, from, to } = event.mark;
    const raw = lines.slice(from, to + 1);
    if (kind === "h2" || kind === "h3") {
      const text = join(raw).replace(HEADING_PREFIX, "");
      if (text) blocks.push({ id: id(), type: "heading", level: kind === "h2" ? 2 : 3, text, from, to });
      continue;
    }
    if (kind === "p") {
      blocks.push({ id: id(), type: "paragraph", text: join(raw), from, to });
      continue;
    }
    const ordered = kind === "number";
    const text = join(raw).replace(ordered ? NUMBER_PREFIX : BULLET_PREFIX, "");
    if (!text) continue;
    const previous = blocks.at(-1);
    const item = { text, from, to };
    if (previous?.type === "list" && previous.ordered === ordered) previous.items.push(item);
    else blocks.push({ id: id(), type: "list", ordered, items: [item] });
  }
  for (const block of blocks) {
    if (block.type === "heading" && block.text.length > ARTICLE_LIMITS.heading) {
      issues.push({ group: "decide", text: `Заголовок длиннее ${ARTICLE_LIMITS.heading} знаков: «${block.text.slice(0, 60)}…» — сократите.` });
    }
    const texts = block.type === "paragraph" ? [block.text] : block.type === "list" ? block.items.map((item) => item.text) : [];
    for (const text of texts) {
      if (text.length > ARTICLE_LIMITS.text) issues.push({ group: "decide", text: `Абзац длиннее ${ARTICLE_LIMITS.text} знаков: «${text.slice(0, 60)}…» — разбейте пустой строкой.` });
    }
  }
  if (blocks.length > ARTICLE_LIMITS.blocks) issues.push({ group: "decide", text: `Блоков больше ${ARTICLE_LIMITS.blocks} — сократите статью.` });
  if (!blocks.some((block) => block.type !== "photo")) issues.push({ group: "decide", text: "В статье нет текста." });
  return { body: { schemaVersion: ARTICLE_SCHEMA_VERSION, blocks }, issues };
}

/** Разметка обратно из блоков — для переноса на изменённый текст (`remap`). */
export function marksOf(body: ArticleBody): Mark[] {
  return body.blocks.flatMap((block): Mark[] => {
    if (block.type === "heading") return [{ kind: block.level === 2 ? "h2" : "h3", from: block.from, to: block.to }];
    if (block.type === "paragraph") return [{ kind: "p", from: block.from, to: block.to }];
    if (block.type === "list") return block.items.map((item) => ({ kind: block.ordered ? "number" : "bullet", from: item.from, to: item.to }));
    return [];
  });
}

/** Анонс для карточки и превью ссылки — первый абзац (ИИ анонс не пишет), до 200 знаков по границе слова. */
export function excerptOf(body: ArticleBody, max = 200): string | null {
  const first = body.blocks.find((block) => block.type === "paragraph") ?? body.blocks.find((block) => block.type === "list");
  const text = first?.type === "paragraph" ? first.text : first?.type === "list" ? first.items.map((item) => item.text).join("; ") : null;
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[\s,.;:—–-]+$/u, "")}…`;
}
