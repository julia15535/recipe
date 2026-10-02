// Одна строка блока «Ингредиенты» в стиле владельца: «Творог 0,5% — 275 г - основной ингредиент»,
// «Разрыхлитель — ½–1 ч. л.», «Чёрный перец / травы — (по желанию)», «молоко 1ст л (если творог сухой)».
import { FRACTION_GLYPHS, compare, parseNumber } from "../fraction";
import type { Quantity } from "../quantity";
import { isKnownUnit, readUnit } from "./units";

export type IngredientLine = { name: string; quantity: Quantity; unit: string | null; note: string | null; main: boolean };
export type LineResult =
  | { ok: true; value: IngredientLine; unknownUnit: string | null }
  | { ok: false; code: "ingredient-unparsed"; name: string };

const NUM = String.raw`(?:\d{1,6}\s+\d{1,6}\/\d{1,6}|\d{1,6}\/\d{1,6}|\d{1,6}(?:[.,]\d{1,6})?(?:\s?[${FRACTION_GLYPHS}])?|[${FRACTION_GLYPHS}])`;
const AMOUNT = new RegExp(String.raw`^(${NUM})(?:\s*[–—-]\s*(${NUM}))?(?![\d/])\s*(.*)$`);
const TRAILING = new RegExp(String.raw`^(.*?\S)\s*(${NUM}(?:\s*[–—-]\s*${NUM})?)\s*(\S.*)$`);
export const MARKER = /^\s*(?:[●•▪◦∙·*]|[-–—](?=\s)|\d{1,2}[.)](?=\s))\s*/;
const MAIN = /(?:\s+[-–—]\s*|,\s*|\s+)основной(?:\s+ингредиент)?\s*$/i;
const MAIN_NOTE = /^основной(?:\s+ингредиент)?$/i;
const SEPARATOR = /\s+[—–-]\s+|\s*—\s*|:\s+/;
const NO_AMOUNT = /^(?:щепотк[аи]|щепоть|по вкусу|по желанию|на кончике ножа|для подачи|для смазывания)$/i;

export function parseIngredientLine(raw: string): LineResult {
  let text = raw.replace(MARKER, "").trim();
  const notes: string[] = [];
  let main = false;
  text = text.replace(/\(([^()]*)\)/g, (_, inner: string) => {
    if (MAIN_NOTE.test(inner.trim())) main = true;
    else if (inner.trim()) notes.push(inner.trim());
    return " ";
  });
  text = text.replace(/\s+/g, " ").trim();
  if (MAIN.test(text)) [text, main] = [text.replace(MAIN, "").trim(), true];
  text = text.replace(/\s*[—–:-]$/, "").trim();

  const split = SEPARATOR.exec(text);
  let name = split ? text.slice(0, split.index).trim() : text;
  let rest = split ? text.slice(split.index + split[0].length).trim() : "";
  if (!split) {
    const trailing = TRAILING.exec(text);
    if (trailing?.[3] && isKnownUnit(trailing[3])) [name, rest] = [trailing[1] ?? "", `${trailing[2]} ${trailing[3]}`];
  }
  name = capitalize(name);
  if (!name) return { ok: false, code: "ingredient-unparsed", name: raw.trim() };
  return withAmount(name, rest, notes, main);
}

function withAmount(name: string, rest: string, notes: string[], main: boolean): LineResult {
  const note = (extra: string[]) => [...extra, ...notes].filter(Boolean).join(", ") || null;
  // Без количества — можно (владелец 02.10: рецепт «свёкла, чеснок, майонез» сохраняется без пересчёта).
  if (rest === "") return ok({ name, quantity: { kind: "none" }, unit: null, note: note([]), main });
  if (NO_AMOUNT.test(rest)) return ok({ name, quantity: { kind: "none" }, unit: null, note: note([rest.toLowerCase()]), main });
  const match = AMOUNT.exec(rest);
  const min = match?.[1] ? parseNumber(match[1]) : null;
  const max = match?.[2] ? parseNumber(match[2]) : null;
  if (!match || !min || min.num === 0 || (match[2] && (!max || compare(min, max) > 0))) {
    return { ok: false, code: "ingredient-unparsed", name };
  }
  const unit = readUnit(match[3] ?? "");
  const quantity: Quantity = max && compare(min, max) !== 0 ? { kind: "range", min, max } : { kind: "exact", amount: min };
  return { ok: true, value: { name, quantity, unit: unit.unit, note: note([unit.extra]), main }, unknownUnit: unit.known ? null : unit.unit };
}

const ok = (value: IngredientLine): LineResult => ({ ok: true, value, unknownUnit: null });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
