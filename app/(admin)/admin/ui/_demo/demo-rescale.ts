// Демо-пересчёт прототипа (ADR-0016): коэффициент от основного ингредиента и ТОЧНОЕ умножение, без
// кулинарного округления. Правила округления — отдельный этап (ADR-0004); настоящий пересчёт будет в
// lib/domain после него, а не здесь.
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

export function formatAmount(value: number): string {
  return NUMBER.format(value);
}

// Значение для поля ввода — без пробела между тысячами («1500», не «1 500»), иначе поле его не примет.
const INPUT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3, useGrouping: false });

export function formatInput(value: number): string {
  return INPUT.format(value);
}

const PLURAL = new Intl.PluralRules("ru-RU");
const SERVINGS: Record<string, string> = { one: "порция", few: "порции", many: "порций", other: "порции" };

// «1 порция», «2 порции», «5 порций», «2,5 порции»; дробные порции допустимы (ADR-0016).
export function servingsLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${NUMBER.format(rounded)} ${SERVINGS[PLURAL.select(rounded)] ?? SERVINGS.other}`;
}
