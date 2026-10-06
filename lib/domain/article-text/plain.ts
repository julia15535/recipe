// Разметка без ИИ (запасной путь): пустая строка и метка фото — граница; «#», «##» — заголовок, «###» — подзаголовок;
// строки с «-», «•», «1.» — пункты списка (следующие строки без значка — продолжение пункта); остальное — абзацы.
// Короткую строку без точки в заголовок не превращаем — угадывать без ИИ ненадёжно (критика Codex 04.10).
import { BULLET_PREFIX, NUMBER_PREFIX } from "./assemble";
import { type ArticleLines, isBlank } from "./lines";
import type { Mark } from "./types";

const HEADING = /^\s*(#{1,3})\s+\S/u;

export function plainMarks({ lines, markers }: Pick<ArticleLines, "lines" | "markers">): Mark[] {
  const marks: Mark[] = [];
  let open: Mark | null = null;
  const close = () => {
    if (open) marks.push(open);
    open = null;
  };
  lines.forEach((line, index) => {
    if (isBlank(line) || markers.has(index)) return close();
    const heading = HEADING.exec(line);
    if (heading) {
      close();
      marks.push({ kind: (heading[1] ?? "").length >= 3 ? "h3" : "h2", from: index, to: index });
      return;
    }
    const kind = BULLET_PREFIX.test(line) ? "bullet" : NUMBER_PREFIX.test(line) ? "number" : null;
    if (kind) {
      close();
      open = { kind, from: index, to: index };
      return;
    }
    if (open) open.to = index;
    else open = { kind: "p", from: index, to: index };
  });
  close();
  return marks;
}
