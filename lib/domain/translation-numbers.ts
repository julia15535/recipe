// Числа в переводе (ADR-0029): ИИ видит вместо них метки ⟦1⟧, ⟦2⟧… и обязан вернуть каждую ровно один раз. Своих
// цифр в ответе быть не может (пересчёт «180 °C (350 °F)», «250 g (9 oz)»), градусы и проценты — не терять.
// Числа (2,5 · 180 · 1/2), простые дроби (½ ⅓ ¼…). Единицы и «°C» остаются в тексте — их переводит ИИ.
const NUMBER = /\d+(?:[.,]\d+)?(?:\/\d+)?|[¼½¾⅓⅔⅛]/g;
const TOKEN = /⟦(\d+)⟧/g;

export type Masked = { text: string; numbers: string[] };

export function maskNumbers(text: string): Masked {
  const numbers: string[] = [];
  const masked = text.replace(NUMBER, (match) => {
    numbers.push(match);
    return `⟦${numbers.length}⟧`;
  });
  return { text: masked, numbers };
}

const count = (text: string, char: string) => text.split(char).length - 1;

/**
 * Метки → числа; на английском десятичная запятая становится точкой. null — метки потеряны, лишние или повторены,
 * в ответе свои числа, Фаренгейт, потерян знак градуса или процента. `masked` — исходный текст с метками.
 */
export function unmaskNumbers(text: string, numbers: readonly string[], lang: "ru" | "en", masked?: string): string | null {
  const seen = [...text.matchAll(TOKEN)].map((match) => Number(match[1]));
  const expected = numbers.map((_, index) => index + 1);
  if (seen.length !== expected.length || [...seen].sort((a, b) => a - b).some((value, index) => value !== expected[index])) return null;
  const rest = text.replace(TOKEN, "");
  if (/\d|[¼½¾⅓⅔⅛]/.test(rest) || /°\s*F\b|℉|fahrenheit/i.test(rest)) return null;
  if (masked !== undefined && (count(text, "°") !== count(masked, "°") || count(text, "%") !== count(masked, "%"))) return null;
  return text.replace(TOKEN, (_, index: string) => {
    const value = numbers[Number(index) - 1] ?? "";
    return lang === "en" ? value.replace(",", ".") : value;
  });
}

