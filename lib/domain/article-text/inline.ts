// Жирный и курсив в тексте статьи (план article-formatting, ADR-0037): в тексте — звёздочки (ставят кнопки «Ж» / «К»),
// на сайте — <strong> / <em>. Не Markdown, а «простое оформление»: `**жирный**`, `*курсив*`, `***оба***`, вложенность
// разного вида («*курсив с **жирным** словом*»). Подряд идущие звёздочки — один знак (1–3; длиннее — текст); знак
// открывает, если справа не пробел и не «,.;:!?)»», закрывает, если слева не пробел и не «(«»; между двумя
// буквами/цифрами не действует («5*3*2»); пары одной длины по стеку («***» может делиться) — непарный знак остаётся
// звёздочкой и не мешает другим парам; `\*` — звёздочка как есть. Текст блока — одна строка (строки абзаца склеены), через блоки не идёт.

export type Run = { text: string; bold: boolean; italic: boolean };
/** Пара знаков в исходном тексте: [начало, конец) открывающего и закрывающего. */
export type Pair = { size: number; open: [number, number]; close: [number, number] };

type Segment = { kind: "text"; value: string } | { kind: "mark"; at: number; size: number; open: boolean; close: boolean };

const WORD = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;
export const NO_OPEN_BEFORE = /[,.;:!?)\]»”]/u;
export const NO_CLOSE_AFTER = /[([«„“]/u;

function segmentsOf(text: string): Segment[] {
  const segments: Segment[] = [];
  let plain = "";
  const flush = () => {
    if (plain) segments.push({ kind: "text", value: plain });
    plain = "";
  };
  for (let at = 0; at < text.length; ) {
    if (text[at] === "\\" && text[at + 1] === "*") {
      plain += "*";
      at += 2;
      continue;
    }
    if (text[at] !== "*") {
      plain += text[at];
      at += 1;
      continue;
    }
    let end = at;
    while (text[end] === "*") end += 1;
    const [before, after] = [text[at - 1], text[end]];
    const inWord = before !== undefined && after !== undefined && WORD.test(before) && WORD.test(after);
    if (end - at > 3 || inWord) plain += text.slice(at, end);
    else {
      flush();
      const open = after !== undefined && !SPACE.test(after) && !NO_OPEN_BEFORE.test(after);
      const close = before !== undefined && !SPACE.test(before) && !NO_CLOSE_AFTER.test(before);
      segments.push({ kind: "mark", at, size: end - at, open, close });
    }
    at = end;
  }
  flush();
  return segments;
}

type Link = { open: number; close: number; size: number; openAt: [number, number]; closeAt: [number, number] };

/**
 * Пары по стеку: закрывающий ищет ближайший открытый; длины равны или одна из них — «***» (тогда знак делится:
 * «*курсив с **жирным***» — «***» закрывает и «**», и «*»). Открытые над найденным — непарные (остаются звёздочками).
 */
function links(segments: Segment[]): Link[] {
  const result: Link[] = [];
  const left = new Map<number, number>(segments.map((segment, index) => [index, segment.kind === "mark" ? segment.size : 0]));
  const stack: number[] = [];
  segments.forEach((segment, index) => {
    if (segment.kind !== "mark") return;
    while (segment.close && (left.get(index) ?? 0) > 0) {
      const need = left.get(index) ?? 0;
      const depth = stack.findLastIndex((at) => {
        const have = left.get(at) ?? 0;
        return at < index - 1 && have > 0 && (have === need || have === 3 || need === 3);
      });
      const opener = stack[depth];
      const openSegment = opener === undefined ? undefined : segments[opener];
      if (opener === undefined || openSegment?.kind !== "mark") break;
      const have = left.get(opener) ?? 0;
      const size = Math.min(have, need);
      const used = segment.size - need;
      result.push({ open: opener, close: index, size, openAt: [openSegment.at + have - size, openSegment.at + have], closeAt: [segment.at + used, segment.at + used + size] });
      left.set(opener, have - size);
      left.set(index, need - size);
      stack.length = have - size > 0 ? depth + 1 : depth;
    }
    if (segment.open && (left.get(index) ?? 0) > 0 && (left.get(index) ?? 0) === segment.size) stack.push(index);
  });
  return result;
}

/** Пары знаков с позициями в тексте — для кнопок «Ж» / «К» (`format-edit.ts`). */
export function pairsOf(text: string): Pair[] {
  return links(segmentsOf(text)).map((link) => ({ size: link.size, open: link.openAt, close: link.closeAt }));
}

/** Текст блока → куски с оформлением; соседние куски одного вида склеены. */
export function inlineRuns(text: string): Run[] {
  const segments = segmentsOf(text);
  const found = links(segments);
  const used = new Map<number, number>();
  for (const link of found) for (const at of [link.open, link.close]) used.set(at, (used.get(at) ?? 0) + link.size);
  const styleAt = (index: number) => ({
    bold: found.some((l) => l.open < index && index < l.close && l.size >= 2),
    italic: found.some((l) => l.open < index && index < l.close && l.size !== 2),
  });
  const runs: Run[] = [];
  segments.forEach((segment, index) => {
    const value = segment.kind === "text" ? segment.value : "*".repeat(segment.size - (used.get(index) ?? 0));
    if (!value) return;
    const { bold, italic } = styleAt(index);
    const last = runs.at(-1);
    if (last && last.bold === bold && last.italic === italic) last.text += value;
    else runs.push({ text: value, bold, italic });
  });
  return runs;
}

/** Текст без знаков оформления — для анонса, alt, заголовков, подписей и сравнения «слова те же». */
export function plainText(text: string): string {
  return inlineRuns(text)
    .map((run) => run.text)
    .join("");
}
