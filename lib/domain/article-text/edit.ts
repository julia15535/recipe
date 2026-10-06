// Правка статьи без нового разбора ИИ: «Добавить фото сюда», «Убрать фото» и перенос меток в «Изменить». Если слова
// не менялись (те же строки с текстом по порядку), прежняя разметка переносится на новые номера строк; абзац, внутрь
// которого перенесли метку, делится на два. Слова поменялись — нужен новый разбор (критика Codex 04.10).
import { assemble, marksOf, marksValid } from "./assemble";
import { type ArticleLines, contentLines, isBlank, markerLine, readLines } from "./lines";
import type { ArticleBody, ArticleIssue, Mark } from "./types";

export type Remapped = { ok: true; body: ArticleBody; issues: ArticleIssue[] } | { ok: false };

/** Прежняя разметка на новом тексте; null-причины — «слова изменились» (нужен разбор) или разметка не легла. */
export function remap(oldText: string, oldBody: ArticleBody, newText: string): Remapped {
  const before = readLines(oldText);
  const after = readLines(newText);
  const [oldContent, newContent] = [contentLines(before), contentLines(after)];
  const same =
    oldContent.length === newContent.length &&
    oldContent.every((line, index) => before.lines[line]?.trim() === after.lines[newContent[index] ?? -1]?.trim());
  if (!same) return { ok: false };
  const ordinal = new Map(oldContent.map((line, index) => [line, index]));
  const marks = marksOf(oldBody).flatMap((mark) => split(after, mark, ordinal, newContent));
  if (!marksValid(after, marks)) return { ok: false };
  const { body, issues } = assemble(after, marks);
  return { ok: true, body, issues: [...after.issues, ...issues] };
}

/** Запись разметки на новых строках; если между её строками теперь метка или пустая строка — делится по кускам. */
function split(after: ArticleLines, mark: Mark, ordinal: Map<number, number>, newContent: number[]): Mark[] {
  const lines: number[] = [];
  for (let line = mark.from; line <= mark.to; line += 1) {
    const at = ordinal.get(line);
    if (at !== undefined) lines.push(newContent[at] ?? -1);
  }
  const runs: Mark[] = [];
  for (const line of lines) {
    const last = runs.at(-1);
    const contiguous = last && line === last.to + 1 && !after.markers.has(line) && !isBlank(after.lines[line] ?? "");
    if (last && contiguous) last.to = line;
    else runs.push({ kind: mark.kind, from: line, to: line });
  }
  return runs;
}

/** Строка-метка после строки `after` (−1 — в самое начало); пустая строка — чтобы метка не прилипала к тексту. */
export function insertMarker(text: string, after: number, key: string): string {
  const lines = text === "" ? [] : text.split("\n");
  const at = after + 1;
  const next = lines[at];
  const insert = [markerLine(key), ...(next !== undefined && !isBlank(next) ? [""] : [])];
  const before = at > 0 && !isBlank(lines[at - 1] ?? "") ? [""] : [];
  lines.splice(at, 0, ...before, ...insert);
  return lines.join("\n");
}

/** Убрать строку-метку (и лишнюю пустую рядом). */
export function removeMarker(text: string, key: string): string {
  const { lines, markers } = readLines(text);
  const index = [...markers].find(([, value]) => value === key)?.[0];
  if (index === undefined) return text;
  const blankAround = isBlank(lines[index - 1] ?? "x") && isBlank(lines[index + 1] ?? "x");
  lines.splice(index, blankAround ? 2 : 1);
  return lines.join("\n");
}

/** Последняя строка блока — после неё «Добавить фото сюда» ставит метку. */
export function lastLineOf(body: ArticleBody, blockId: string): number | null {
  const block = body.blocks.find((item) => item.id === blockId);
  if (!block) return null;
  if (block.type === "photo") return block.line;
  if (block.type === "list") return block.items.at(-1)?.to ?? null;
  return block.to;
}
