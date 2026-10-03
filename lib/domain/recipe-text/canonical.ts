// Черновик → аккуратный текст в формате разбора (`parse.ts`): так рецепт показывается в «Изменить» и хранится
// в `recipes.source_text`. Владелец правит его словами и снова нажимает «Разобрать».
import type { AmountStyle, Fraction } from "../fraction";
import type { Quantity } from "../quantity";
import type { Labels } from "./from-ai";
import type { RecipeDraft } from "./parse";

// Конечная десятичная дробь: знаменатель только из двоек и пятёрок (1/2, 1/8, 3/20).
const finite = (den: number): boolean => {
  let d = den;
  for (const p of [2, 5]) while (d % p === 0) d /= p;
  return d === 1;
};

/** Число в записи автора (ADR-0032): дробь — «1 1/2», десятичная — «1,5»; без вида — десятичная, если она
 * конечна, иначе дробь («1/3» — «0,3» потерял бы точность при новом разборе). */
function number(value: Fraction, style?: AmountStyle): string {
  if (value.den === 1) return String(value.num);
  const whole = Math.floor(value.num / value.den);
  const rest = value.num - whole * value.den;
  if (style !== "fraction" && finite(value.den)) return String(value.num / value.den).replace(".", ",");
  return whole ? `${whole} ${rest}/${value.den}` : `${rest}/${value.den}`;
}

function amount(quantity: Quantity, style?: AmountStyle): string {
  if (quantity.kind === "exact") return number(quantity.amount, style);
  if (quantity.kind === "range") return `${number(quantity.min, style)}–${number(quantity.max, style)}`;
  return "";
}

export function toCanonicalText(draft: RecipeDraft, mainIndex: number | null, labels: Labels): string {
  const words = [...draft.sections.map((code) => labels.sections.get(code)), ...draft.tags.map((code) => labels.tags.get(code))];
  const lines = [draft.title];
  if (draft.description) lines.push(`Описание: ${draft.description}`);
  if (draft.time) lines.push(`Время: ${draft.time}`);
  if (draft.yield) lines.push(`Выход: ${number(draft.yield.amount)} ${draft.yield.forms[2]}`);
  lines.push(`Теги: ${words.filter(Boolean).join(", ").toLowerCase()}`, "", "Ингредиенты:");
  draft.ingredients.forEach((item, index) => {
    const value = [amount(item.quantity, item.amountStyle), item.unit ?? ""].filter(Boolean).join(" ");
    const tail = value || (item.note ?? "");
    const note = value && item.note ? ` (${item.note.replace(/[()]/g, "")})` : "";
    const main = index === mainIndex ? " - основной ингредиент" : "";
    lines.push(tail ? `- ${item.name} — ${tail}${note}${main}` : `- ${item.name}${main}`);
  });
  lines.push("", "Приготовление:", ...draft.steps.map((step, index) => `${index + 1}. ${step}`));
  if (draft.tips.length) lines.push("", "Советы:", ...draft.tips.map((tip) => `- ${tip}`));
  return lines.join("\n");
}
