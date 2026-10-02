// Демо-пересчёт прототипа (ADR-0016): коэффициент от основного ингредиента и ТОЧНОЕ умножение, без
// кулинарного округления. Правила округления — отдельный этап (ADR-0004); настоящий пересчёт будет в
// lib/domain после него, а не здесь.
import type { DemoQuantity } from "./demo-types";

const AMOUNT = /^\d+([.,]\d+)?$/;
export const MAX_FACTOR = 20;

export type AmountCheck = { ok: true; value: number } | { ok: false; reason: "empty" | "format" | "zero" | "tooBig" };

// Посетитель вписывает своё количество основного ингредиента: «250», «2,5» (RU) или «2.5» (EN).
export function parseAmount(raw: string, base: number): AmountCheck {
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (!AMOUNT.test(text)) return { ok: false, reason: "format" };
  const value = Number(text.replace(",", "."));
  if (value <= 0) return { ok: false, reason: "zero" };
  if (value > base * MAX_FACTOR) return { ok: false, reason: "tooBig" };
  return { ok: true, value };
}

const NUMBER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const SMALL = new Intl.NumberFormat("ru-RU", { maximumSignificantDigits: 2 });

// Простые дроби (¼ ⅓ ½ ⅔ ¾, «1½») — форма записи, не округление: только для ложек и штук и только если
// значение равно дроби (допуск 10⁻⁶ — 0,249 не станет ¼). Граммы и миллилитры — десятичной записью.
const FRACTIONS: readonly (readonly [number, string])[] = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];
const FRACTION_UNITS = new Set(["ч. л.", "ст. л.", "шт."]);
const EPSILON = 1e-6;

function asFraction(value: number): string | null {
  const whole = Math.floor(value + EPSILON);
  const rest = value - whole;
  if (Math.abs(rest) < EPSILON) return NUMBER.format(whole);
  const glyph = FRACTIONS.find(([fraction]) => Math.abs(rest - fraction) < EPSILON)?.[1];
  if (!glyph) return null;
  return whole > 0 ? `${whole}${glyph}` : glyph;
}

// До десятых; меньше единицы — две значащие цифры, чтобы малое количество не превращалось в «0».
export function formatAmount(value: number, unit?: string): string {
  const fraction = unit && FRACTION_UNITS.has(unit) ? asFraction(value) : null;
  if (fraction) return fraction;
  return value > 0 && value < 1 ? SMALL.format(value) : NUMBER.format(value);
}

// Количество строки × коэффициент: точное — одно число, диапазон — оба конца («½–1» × 2 → «1–2»);
// без количества («по желанию») — null, строка не пересчитывается.
export function formatQuantity(quantity: DemoQuantity, factor: number, unit?: string): string | null {
  if (quantity.kind === "exact") return formatAmount(quantity.value * factor, unit);
  if (quantity.kind === "range") {
    const [min, max] = [formatAmount(quantity.min * factor, unit), formatAmount(quantity.max * factor, unit)];
    return min === max ? min : `${min}–${max}`;
  }
  return null;
}

// Значение для поля ввода — без пробела между тысячами («1500», не «1 500»), иначе поле его не примет.
const INPUT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3, useGrouping: false });

export function formatInput(value: number): string {
  return INPUT.format(value);
}

const PLURAL = new Intl.PluralRules("ru-RU");
const SERVINGS = ["порция", "порции", "порций"] as const;

// Выход: «1 порция», «2 порции», «5 порций», «2,5 порции»; у изделий свои формы — «4 вафли», «8 вафель».
// Дробный выход допустим (ADR-0016).
export function yieldLabel(value: number, forms: readonly [string, string, string] = SERVINGS): string {
  const rounded = Math.round(value * 10) / 10;
  const category = PLURAL.select(rounded);
  const word = category === "one" ? forms[0] : category === "many" ? forms[2] : forms[1];
  return `${NUMBER.format(rounded)} ${word}`;
}
