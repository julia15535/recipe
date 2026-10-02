// Черновик → аккуратный текст в формате разбора (`parse.ts`): так рецепт показывается в «Изменить» и хранится
// в `recipes.source_text`. Владелец правит его словами и снова нажимает «Разобрать».
import type { Fraction } from "../fraction";
import type { Quantity } from "../quantity";
import type { Labels } from "./from-ai";
import type { RecipeDraft } from "./parse";

const DECIMAL = new Set([2, 4, 5, 8, 10, 20, 25, 50, 100, 1000]);

function number(value: Fraction): string {
  if (value.den === 1) return String(value.num);
  const whole = Math.floor(value.num / value.den);
  const rest = value.num - whole * value.den;
  if (DECIMAL.has(value.den) && value.den >= 10) return String(value.num / value.den).replace(".", ",");
  return whole ? `${whole} ${rest}/${value.den}` : `${rest}/${value.den}`;
}

function amount(quantity: Quantity): string {
  if (quantity.kind === "exact") return number(quantity.amount);
  if (quantity.kind === "range") return `${number(quantity.min)}–${number(quantity.max)}`;
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
    const value = [amount(item.quantity), item.unit ?? ""].filter(Boolean).join(" ");
    const tail = value || (item.note ?? "");
    const note = value && item.note ? ` (${item.note.replace(/[()]/g, "")})` : "";
    lines.push(`- ${item.name} — ${tail}${note}${index === mainIndex ? " - основной ингредиент" : ""}`);
  });
  lines.push("", "Приготовление:", ...draft.steps.map((step, index) => `${index + 1}. ${step}`));
  if (draft.tips.length) lines.push("", "Советы:", ...draft.tips.map((tip) => `- ${tip}`));
  return lines.join("\n");
}
