// Пересчёт от основного ингредиента (ADR-0016): коэффициент = своё количество / количество в рецепте,
// точно в дробях; округление для показа — `rounding.ts` (ADR-0026).
import { type Fraction, div, fraction, mul, parseDecimal, toNumber } from "./fraction";
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
const SMALL = perLang((locale) => new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }));
const INPUT = perLang((locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }));
const PLURAL = perLang((locale) => new Intl.PluralRules(locale));

// Простые дроби — форма записи для ложек и штук, только когда значение и есть такая дробь.
const GLYPH: Record<string, string> = { "1/4": "¼", "1/3": "⅓", "1/2": "½", "2/3": "⅔", "3/4": "¾" };
const FRACTION_UNITS = new Set(["ч. л.", "ст. л.", "шт."]);

/** До десятых; меньше единицы — две значащие цифры; ложки и штуки — «½», «1⅓». */
export function formatAmount(value: Fraction, unit?: string | null, lang: Lang = "ru"): string {
  if (unit && FRACTION_UNITS.has(unit)) {
    const whole = Math.floor(value.num / value.den);
    const rest = fraction(value.num - whole * value.den, value.den);
    if (rest.num === 0) return NUMBER(lang).format(whole);
    const glyph = GLYPH[`${rest.num}/${rest.den}`];
    if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  const number = toNumber(value);
  return number > 0 && number < 1 ? SMALL(lang).format(number) : NUMBER(lang).format(number);
}

/** Количество строки × коэффициент; диапазон — оба конца; без количества — null. */
export function formatQuantity(quantity: Quantity, factor: Fraction, unit?: string | null, lang: Lang = "ru"): string | null {
  if (quantity.kind === "exact") return formatAmount(mul(quantity.amount, factor), unit, lang);
  if (quantity.kind === "range") {
    const [min, max] = [formatAmount(mul(quantity.min, factor), unit, lang), formatAmount(mul(quantity.max, factor), unit, lang)];
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
