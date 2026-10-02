// Пересчёт от основного ингредиента (ADR-0016): коэффициент = своё количество / количество в рецепте,
// точно в дробях, без кулинарного округления (правила округления — отдельный этап, ADR-0004).
import { type Fraction, div, fraction, mul, parseDecimal, toNumber } from "./fraction";
import type { Quantity } from "./quantity";

export const MAX_FACTOR = 20;
export const ONE = fraction(1);

export type AmountCheck = { ok: true; value: Fraction } | { ok: false; reason: "empty" | "format" | "zero" | "tooBig" };

/** Своё количество основного ингредиента: «250», «2,5» (RU) или «2.5» (EN). */
export function parseAmount(raw: string, base: Fraction): AmountCheck {
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "empty" };
  const value = parseDecimal(text);
  if (!value) return { ok: false, reason: "format" };
  if (value.num === 0) return { ok: false, reason: "zero" };
  if (toNumber(value) > toNumber(base) * MAX_FACTOR) return { ok: false, reason: "tooBig" };
  return { ok: true, value };
}

export const factorOf = (value: Fraction, base: Fraction): Fraction => div(value, base);

const NUMBER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const SMALL = new Intl.NumberFormat("ru-RU", { maximumSignificantDigits: 2 });
const INPUT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3, useGrouping: false });

// Простые дроби — форма записи для ложек и штук, только когда значение и есть такая дробь.
const GLYPH: Record<string, string> = { "1/4": "¼", "1/3": "⅓", "1/2": "½", "2/3": "⅔", "3/4": "¾" };
const FRACTION_UNITS = new Set(["ч. л.", "ст. л.", "шт."]);

/** До десятых; меньше единицы — две значащие цифры; ложки и штуки — «½», «1⅓». */
export function formatAmount(value: Fraction, unit?: string | null): string {
  if (unit && FRACTION_UNITS.has(unit)) {
    const whole = Math.floor(value.num / value.den);
    const rest = fraction(value.num - whole * value.den, value.den);
    if (rest.num === 0) return NUMBER.format(whole);
    const glyph = GLYPH[`${rest.num}/${rest.den}`];
    if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  const number = toNumber(value);
  return number > 0 && number < 1 ? SMALL.format(number) : NUMBER.format(number);
}

/** Количество строки × коэффициент; диапазон — оба конца; без количества — null. */
export function formatQuantity(quantity: Quantity, factor: Fraction, unit?: string | null): string | null {
  if (quantity.kind === "exact") return formatAmount(mul(quantity.amount, factor), unit);
  if (quantity.kind === "range") {
    const [min, max] = [formatAmount(mul(quantity.min, factor), unit), formatAmount(mul(quantity.max, factor), unit)];
    return min === max ? min : `${min}–${max}`;
  }
  return null;
}

/** Значение поля ввода — без пробела между тысячами, иначе поле его не примет. */
export const formatInput = (value: Fraction): string => INPUT.format(toNumber(value));

const PLURAL = new Intl.PluralRules("ru-RU");
export const SERVINGS = ["порция", "порции", "порций"] as const;
export type WordForms = readonly [one: string, few: string, many: string];

/** Выход: «1 порция», «2,5 порции», «4 вафли», «8 вафель»; дробный выход допустим. */
export function yieldLabel(value: Fraction, forms: WordForms = SERVINGS): string {
  const rounded = Math.round(toNumber(value) * 10) / 10;
  const category = PLURAL.select(rounded);
  const word = category === "one" ? forms[0] : category === "many" ? forms[2] : forms[1];
  return `${NUMBER.format(rounded)} ${word}`;
}
