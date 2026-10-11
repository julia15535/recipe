// Жирный и курсив в тексте статьи (план article-formatting, ADR-0037): в тексте — звёздочки (ставят кнопки «Ж» / «К»),
// на сайте — <strong> / <em>. Не Markdown, а «простое оформление»: `**жирный**`, `*курсив*`, `***оба***`. Подряд идущие
// звёздочки — один знак; знак открывает, если справа не пробел, закрывает, если слева не пробел; между двумя
// буквами/цифрами не действует («5*3*2», «до**важно**после»); пары одной длины, без вложенности; `\*` — звёздочка
// как есть; непарное — как есть. Текст блока — одна строка (строки абзаца уже склеены), через блоки выделение не идёт.

export type Run = { text: string; bold: boolean; italic: boolean };

type Token = { kind: "text"; value: string } | { kind: "mark"; size: number; open: boolean; close: boolean };

const WORD = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let plain = "";
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
    const size = end - at;
    if (size > 3 || inWord) {
      plain += text.slice(at, end);
    } else {
      if (plain) tokens.push({ kind: "text", value: plain });
      plain = "";
      tokens.push({ kind: "mark", size, open: after !== undefined && !SPACE.test(after), close: before !== undefined && !SPACE.test(before) });
    }
    at = end;
  }
  if (plain) tokens.push({ kind: "text", value: plain });
  return tokens;
}

/** Текст блока → куски с оформлением; соседние куски одного вида склеены. */
export function inlineRuns(text: string): Run[] {
  const tokens = tokenize(text);
  // Пары: открытый знак ждёт закрывающий той же длины; другие знаки, пока он открыт, — просто текст.
  const pair = new Map<number, number>();
  let open: number | null = null;
  tokens.forEach((token, index) => {
    if (token.kind !== "mark") return;
    const opened = open === null ? null : tokens[open];
    if (opened?.kind === "mark" && open !== null && token.close && token.size === opened.size && index > open + 1) {
      pair.set(open, index);
      open = null;
    } else if (open === null && token.open) open = index;
  });
  const runs: Run[] = [];
  const push = (value: string, bold: boolean, italic: boolean) => {
    const last = runs.at(-1);
    if (last && last.bold === bold && last.italic === italic) last.text += value;
    else if (value) runs.push({ text: value, bold, italic });
  };
  let style: { bold: boolean; italic: boolean; until: number } | null = null;
  tokens.forEach((token, index) => {
    if (style && index === style.until) {
      style = null;
      return;
    }
    if (token.kind === "text") return push(token.value, style?.bold ?? false, style?.italic ?? false);
    const until = pair.get(index);
    if (until !== undefined && !style) {
      style = { bold: token.size >= 2, italic: token.size !== 2, until };
      return;
    }
    push("*".repeat(token.size), style?.bold ?? false, style?.italic ?? false);
  });
  return runs;
}

/** Текст без знаков оформления — для анонса, alt, заголовков и подписей (там жирного и курсива нет). */
export function plainText(text: string): string {
  return inlineRuns(text)
    .map((run) => run.text)
    .join("");
}
