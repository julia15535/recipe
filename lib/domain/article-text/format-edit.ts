// Кнопки «Ж» / «К» над полем текста статьи (план article-formatting, ADR-0037): выделенное — жирным / курсивом или
// снять. Звёздочки — служебные, на сайте их не видно (`inline.ts`). Чистая функция: текст + выделение → текст +
// выделение. Что бы ни выделили, результат разбирается без видимых звёздочек: выделение расширяется до целых слов,
// служебное начало строки («# », «- », «1. ») и строка-метка фото не оборачиваются, пересекающиеся выделения поглощаются.
import { NO_CLOSE_AFTER, NO_OPEN_BEFORE, pairsOf } from "./inline";

export type Selection = { text: string; start: number; end: number };
export type Style = "bold" | "italic";

const SIZE: Record<Style, number> = { bold: 2, italic: 1 };
const WORD = /[\p{L}\p{N}]/u;
const PREFIX = /^\s*(?:#{1,6}\s+|[-•●▪]\s+|\*\s+|\d{1,3}[.)]\s+)/u;
const PHOTO = /^\s*\[\s*фото\s+[a-z0-9]{4}\s*\]\s*$/iu;

const hasStyle = (size: number, style: Style) => (style === "bold" ? size >= 2 : size !== 2);
const isWord = (char: string | undefined) => char !== undefined && WORD.test(char);
const span = ([from, to]: [number, number]) => Array.from({ length: to - from }, (_, i) => from + i);

/** Одна строка [lineStart, lineEnd): добавить или снять стиль на [from, to). */
function toggleLine(text: string, lineStart: number, lineEnd: number, from0: number, to0: number, style: Style): Selection {
  const line = text.slice(lineStart, lineEnd);
  if (PHOTO.test(line)) return { text, start: from0, end: to0 };
  const contentStart = lineStart + (PREFIX.exec(line)?.[0].length ?? 0);
  let [from, to] = [Math.max(from0, contentStart), Math.min(to0, lineEnd)];
  // Края без пробелов, звёздочек и знаков, у которых выделение не может начаться («, ») или закончиться («(»).
  while (from < to && (/[\s*]/u.test(text[from] ?? "") || NO_OPEN_BEFORE.test(text[from] ?? ""))) from += 1;
  while (to > from && (/[\s*]/u.test(text[to - 1] ?? "") || NO_CLOSE_AFTER.test(text[to - 1] ?? ""))) to -= 1;
  const size = SIZE[style];
  const marks = "*".repeat(size);
  const shiftBy = ([a, b]: [number, number]): [number, number] => [a + lineStart, b + lineStart];
  const pairs = () => pairsOf(text.slice(lineStart, lineEnd)).map((p) => ({ ...p, open: shiftBy(p.open), close: shiftBy(p.close) }));
  const edit = (at: number, length: number, insert: string) => {
    text = text.slice(0, at) + insert + text.slice(at + length);
    const shift = insert.length - length;
    lineEnd += shift;
    if (from >= at + length) from += shift;
    if (to >= at + length) to += shift;
  };

  if (from >= to && from0 !== to0) return { text, start: from0, end: to0 }; // выделены только звёздочки и пробелы
  if (from >= to) {
    // Без выделения: пустая пара под курсором — убрать, иначе вставить и поставить курсор между знаками.
    const at = Math.max(from0, contentStart);
    if (text.slice(at - size, at) === marks && text.slice(at, at + size) === marks && text[at - size - 1] !== "*" && text[at + size] !== "*") {
      text = text.slice(0, at - size) + text.slice(at + size);
      return { text, start: at - size, end: at - size };
    }
    text = text.slice(0, at) + marks + marks + text.slice(at);
    return { text, start: at + size, end: at + size };
  }
  // Целые слова: знак внутри слова не действует. Без слов (запятая, пробелы) — нечего выделять.
  // Звёздочка внутри «5*3» и «\*» — часть слова: выделение их не разрезает.
  const wordAt = (at: number) =>
    isWord(text[at]) || (text[at] === "*" && (text[at - 1] === "\\" || (isWord(text[at - 1]) && isWord(text[at + 1])))) || (text[at] === "\\" && text[at + 1] === "*");
  while (from > contentStart && wordAt(from - 1) && wordAt(from)) from -= 1;
  while (to < lineEnd && wordAt(to - 1) && wordAt(to)) to += 1;
  if (![...text.slice(from, to)].some(isWord)) return { text, start: from0, end: to0 };

  // Уже в этом стиле — снять (со всего куска, в котором лежит выделение).
  const holder = pairs().find((p) => hasStyle(p.size, style) && p.open[1] <= from && to <= p.close[0]);
  if (holder) {
    const keep = holder.size === 3 ? "*".repeat(3 - size) : "";
    const [contentFrom, contentTo] = [holder.open[1], holder.close[0]];
    from = contentFrom;
    to = contentTo;
    edit(holder.close[0], holder.size, keep);
    edit(holder.open[0], holder.size, keep);
    return { text, start: from, end: to };
  }
  // Пересекающиеся пары поглощаем, такие же внутри — убираем: вложенность только правильная и разного вида.
  for (let guard = 0; guard < 50; guard += 1) {
    const list = pairs();
    const crossing = list.find((p) => {
      const inside = from <= p.open[0] && p.close[1] <= to;
      const outside = p.open[1] <= from && to <= p.close[0];
      // Вплотную к выделению — тоже поглощаем: иначе звёздочки слились бы в одну («*сыр**,*»).
      const apart = p.close[1] < from || to < p.open[0];
      return !inside && !outside && !apart;
    });
    if (crossing) {
      from = Math.min(from, crossing.open[0]);
      to = Math.max(to, crossing.close[1]);
      continue;
    }
    const same = list.find((p) => hasStyle(p.size, style) && from <= p.open[0] && p.close[1] <= to);
    if (!same) break;
    const keep = same.size === 3 ? "*".repeat(3 - size) : "";
    edit(same.close[0], same.size, keep);
    edit(same.open[0], same.size, keep);
  }
  // Одиночная звёздочка вплотную (сноска) слилась бы с новыми знаками — помечаем её как обычный символ «\*».
  const markers = new Set(pairs().flatMap((p) => [...span(p.open), ...span(p.close)]));
  const literal = (at: number) => text[at] === "*" && !markers.has(at) && text[at - 1] !== "\\";
  const [escapeLeft, escapeRight] = [literal(from - 1), literal(to)];
  const head = escapeLeft ? `${text.slice(0, from - 1)}\\*` : text.slice(0, from);
  text = `${head}${marks}${text.slice(from, to)}${marks}${escapeRight ? "\\" : ""}${text.slice(to)}`;
  const start = from + (escapeLeft ? 1 : 0) + size;
  return { text, start, end: start + (to - from) };
}

/** Выделение через несколько строк — каждая строка отдельно (выделение не переходит через строку). */
export function toggleStyle({ text, start, end }: Selection, style: Style): Selection {
  const lines: [number, number][] = [];
  for (let lineStart = text.lastIndexOf("\n", start - 1) + 1; lineStart <= end; ) {
    const newline = text.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? text.length : newline;
    lines.push([lineStart, lineEnd]);
    if (newline === -1) break;
    lineStart = newline + 1;
  }
  if (lines.length === 1) {
    const [lineStart, lineEnd] = lines[0] ?? [0, text.length];
    return toggleLine(text, lineStart, lineEnd, start, end, style);
  }
  // С конца: правка строки не сдвигает строки выше.
  let next = text;
  for (const [lineStart, lineEnd] of lines.reverse()) {
    const [from, to] = [Math.max(start, lineStart), Math.min(end, lineEnd)];
    if ([...next.slice(from, to)].some(isWord)) next = toggleLine(next, lineStart, lineEnd, from, to, style).text;
  }
  return { text: next, start, end: end + next.length - text.length };
}
