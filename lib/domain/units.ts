import type { Lang } from "./lang";

// Единицы в данных — русские коды (`г`, `ч. л.`, `стак.` — `lib/domain/recipe-text/units.ts`), и в переводе тоже:
// меры не конвертируются (владелец 03.10: «как у меня»). Для показа на английском — подпись по коду; авторская
// единица («горсть») — английские формы из перевода. Штуки по-английски без единицы: «2 eggs».
type Forms = readonly [one: string, other: string];
const EN: Record<string, Forms> = {
  г: ["g", "g"],
  кг: ["kg", "kg"],
  мл: ["ml", "ml"],
  л: ["l", "l"],
  "ч. л.": ["tsp", "tsp"],
  "ст. л.": ["tbsp", "tbsp"],
  "стак.": ["cup", "cups"],
  "щеп.": ["pinch", "pinches"],
  "зуб.": ["clove", "cloves"],
  "пуч.": ["bunch", "bunches"],
  "шт.": ["", ""],
};

/** Подпись единицы для показа; `amount` — для формы слова (больше 1 — множественное). null — без единицы. */
export function unitLabel(unit: string | null, lang: Lang, amount: number, custom?: Forms | null): string | null {
  if (!unit) return null;
  if (lang === "ru") return unit;
  const forms = EN[unit] ?? custom;
  if (!forms) return unit;
  const word = amount > 1 ? forms[1] : forms[0];
  return word === "" ? null : word;
}

/** Известна ли единица (для перевода: неизвестной нужны английские формы от ИИ). */
export const isCanonicalUnit = (unit: string) => Object.hasOwn(EN, unit);
