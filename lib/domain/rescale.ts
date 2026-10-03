// Пересчёт от основного ингредиента (ADR-0016): коэффициент = своё количество / количество в рецепте,
// точно в дробях; округление для показа — `rounding.ts` (ADR-0026).
import { type AmountStyle, type Fraction, div, fraction, mul, parseDecimal, toNumber } from "./fraction";
import { type Lang, perLang } from "./lang";
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

// Числа по языку: ru «2,5», en «2.5».
const NUMBER = perLang((locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }));
const QUARTER = perLang((locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }));
const SMALL = perLang((locale) => new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }));
const INPUT = perLang((locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }));
const PLURAL = perLang((locale) => new Intl.PluralRules(locale));

const multipleOf = (value: number, part: number) => Math.abs(value / part - Math.round(value / part)) < 1e-9;

/** Дробью, как пишет автор: «1/2», «1 1/2», «2/3»; целое — числом. */
function asFraction(value: Fraction, lang: Lang): string {
  const whole = Math.floor(value.num / value.den);
  const rest = value.num - whole * value.den;
  if (rest === 0) return NUMBER(lang).format(whole);
  return whole ? `${NUMBER(lang).format(whole)} ${rest}/${value.den}` : `${rest}/${value.den}`;
}

/**
 * Количество в записи автора (ADR-0032): дробь — дробью («1/2», «1 1/2»); десятичная и без вида — десятичной
 * (ADR-0030): половины и четверти — точно («0,25», «1,75»), трети — до десятых («0,3»), остальное — до десятых,
 * меньше единицы — две значащие цифры.
 */
export function formatAmount(value: Fraction, lang: Lang = "ru", style?: AmountStyle): string {
  if (style === "fraction") return asFraction(value, lang);
  const number = toNumber(value);
  if (multipleOf(number, 0.25)) return QUARTER(lang).format(number);
  if (multipleOf(number, 1 / 3)) return NUMBER(lang).format(number);
  return number > 0 && number < 1 ? SMALL(lang).format(number) : NUMBER(lang).format(number);
}

/** Округлённое значение (шаги ¼ и ½) в записи строки: дробью, если это четверти, иначе — десятичной. */
export function formatRounded(value: number, lang: Lang = "ru", style?: AmountStyle): string {
  if (style === "fraction" && multipleOf(value, 0.25)) return asFraction(fraction(Math.round(value * 4), 4), lang);
  return QUARTER(lang).format(value);
}

/** Количество строки × коэффициент; диапазон — оба конца; без количества — null. */
export function formatQuantity(quantity: Quantity, factor: Fraction, lang: Lang = "ru", style?: AmountStyle): string | null {
  if (quantity.kind === "exact") return formatAmount(mul(quantity.amount, factor), lang, style);
  if (quantity.kind === "range") {
    const [min, max] = [formatAmount(mul(quantity.min, factor), lang, style), formatAmount(mul(quantity.max, factor), lang, style)];
    return min === max ? min : `${min}–${max}`;
  }
  return null;
}

/** Значение поля ввода — без пробела между тысячами, иначе поле его не примет. */
export const formatInput = (value: Fraction, lang: Lang = "ru"): string => INPUT(lang).format(toNumber(value));

/** Формы слова выхода: русские — одна/несколько/много («вафля / вафли / вафель»), английские — одна/много. */
export type WordForms = readonly [one: string, few: string, many: string] | readonly [one: string, other: string];
export const SERVINGS = ["порция", "порции", "порций"] as const;
export const SERVINGS_EN = ["serving", "servings"] as const;

/** Выход: «1 порция», «2,5 порции», «4 вафли», «8 вафель» / «1 serving», «2.5 servings»; дробный выход допустим. */
export function yieldLabel(value: Fraction, forms: WordForms = SERVINGS, lang: Lang = "ru"): string {
  const rounded = Math.round(toNumber(value) * 10) / 10;
  const category = PLURAL(lang).select(rounded);
  const word = forms.length === 2 ? (category === "one" ? forms[0] : forms[1]) : category === "one" ? forms[0] : category === "many" ? forms[2] : forms[1];
  return `${NUMBER(lang).format(rounded)} ${word}`;
}
