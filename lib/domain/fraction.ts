// Точные дроби для количеств (½, ⅓, «1½»): числитель и знаменатель — целые, всегда сокращены.
// Число с плавающей точкой не хранит треть точно, поэтому и в БД — пара целых (план recipe-upload).
export type Fraction = { readonly num: number; readonly den: number };

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const GLYPHS: Record<string, readonly [number, number]> = {
  "¼": [1, 4],
  "½": [1, 2],
  "¾": [3, 4],
  "⅓": [1, 3],
  "⅔": [2, 3],
  "⅛": [1, 8],
};
export const FRACTION_GLYPHS = Object.keys(GLYPHS).join("");

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}

/** Сокращённая дробь; слишком длинная (после многих умножений) — приближение до миллионных. */
export function fraction(num: number | bigint, den: number | bigint = 1): Fraction {
  let n = BigInt(num);
  let d = BigInt(den);
  if (d === 0n) throw new RangeError("знаменатель дроби — ноль");
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  [n, d] = [n / g, d / g];
  if (n > SAFE || -n > SAFE || d > SAFE) return fraction(Math.round((Number(n) / Number(d)) * 1e6), 1_000_000);
  return { num: Number(n), den: Number(d) };
}

export const mul = (a: Fraction, b: Fraction): Fraction => fraction(BigInt(a.num) * BigInt(b.num), BigInt(a.den) * BigInt(b.den));
export const div = (a: Fraction, b: Fraction): Fraction => fraction(BigInt(a.num) * BigInt(b.den), BigInt(a.den) * BigInt(b.num));
export const toNumber = (f: Fraction): number => f.num / f.den;

/** Сравнение без деления: < 0, 0, > 0. */
export function compare(a: Fraction, b: Fraction): number {
  const diff = BigInt(a.num) * BigInt(b.den) - BigInt(b.num) * BigInt(a.den);
  return diff === 0n ? 0 : diff < 0n ? -1 : 1;
}

/** «275», «0,5», «2.5» → дробь (десятичная запись точно: 0,125 = 1/8). */
export function parseDecimal(text: string): Fraction | null {
  const match = /^(\d{1,9})(?:[.,](\d{1,6}))?$/.exec(text.trim());
  if (!match) return null;
  const decimals = match[2] ?? "";
  return fraction(BigInt(`${match[1]}${decimals}`), 10n ** BigInt(decimals.length));
}

/** Число из рецепта: «2», «0,5», «½», «1½», «1/2», «1 1/2». */
export function parseNumber(text: string): Fraction | null {
  const value = text.trim();
  const glyph = new RegExp(`^(\\d{1,6})?\\s*([${FRACTION_GLYPHS}])$`).exec(value);
  if (glyph) {
    const [num, den] = GLYPHS[glyph[2] ?? ""] ?? [0, 1];
    return fraction(BigInt(glyph[1] ?? 0) * BigInt(den) + BigInt(num), den);
  }
  const slash = /^(?:(\d{1,6})\s+)?(\d{1,6})\/(\d{1,6})$/.exec(value);
  if (slash) {
    const den = BigInt(slash[3] ?? 1);
    return den === 0n ? null : fraction(BigInt(slash[1] ?? 0) * den + BigInt(slash[2] ?? 0), den);
  }
  return parseDecimal(value);
}
