// Кнопки «Ж» / «К» над полем текста статьи (план article-formatting): обернуть выделенное звёздочками или снять их.
// Звёздочки — служебные, на сайте их не видно (`inline.ts`). Чистая функция: текст + выделение → текст + выделение.
export type Selection = { text: string; start: number; end: number };
export type Style = "bold" | "italic";

const SIZE: Record<Style, number> = { bold: 2, italic: 1 };

const starsBefore = (text: string, at: number) => {
  let count = 0;
  while (text[at - 1 - count] === "*") count += 1;
  return count;
};
const starsAfter = (text: string, at: number) => {
  let count = 0;
  while (text[at + count] === "*") count += 1;
  return count;
};
// Есть ли вокруг слов этот стиль: 2 и 3 звёздочки — жирный, 1 и 3 — курсив.
const has = (stars: number, style: Style) => (style === "bold" ? stars === 2 || stars === 3 : stars === 1 || stars === 3);

/** Одна строка: выделение без пробелов по краям; повтор снимает; пустое — пара знаков и курсор между ними. */
function toggleLine(text: string, start: number, end: number, style: Style): Selection {
  const size = SIZE[style];
  let [from, to] = [start, end];
  while (from < to && /\s/u.test(text[from] ?? "")) from += 1;
  while (to > from && /\s/u.test(text[to - 1] ?? "")) to -= 1;
  // Выделили вместе со звёздочками («**слово**») — смотрим на слова внутри.
  while (from < to && text[from] === "*" && text[to - 1] === "*" && to - from > 2) [from, to] = [from + 1, to - 1];
  const [before, after] = [starsBefore(text, from), starsAfter(text, to)];
  if (from < to && before === after && has(before, style)) {
    const next = text.slice(0, from - size) + text.slice(from, to) + text.slice(to + size);
    return { text: next, start: from - size, end: to - size };
  }
  const marks = "*".repeat(size);
  const next = text.slice(0, from) + marks + text.slice(from, to) + marks + text.slice(to);
  return { text: next, start: from + size, end: to + size };
}

/** Выделение через несколько строк — каждая непустая строка отдельно (выделение не переходит через строку). */
export function toggleStyle({ text, start, end }: Selection, style: Style): Selection {
  if (!text.slice(start, end).includes("\n")) return toggleLine(text, start, end, style);
  const segments: [number, number][] = [];
  for (let from = start; from <= end; ) {
    const newline = text.indexOf("\n", from);
    const to = newline === -1 || newline > end ? end : newline;
    if (text.slice(from, to).trim()) segments.push([from, to]);
    from = to + 1;
  }
  // С конца: правка строки не сдвигает строки выше.
  let next = text;
  for (const [from, to] of segments.reverse()) next = toggleLine(next, from, to, style).text;
  return { text: next, start, end: end + next.length - text.length };
}
