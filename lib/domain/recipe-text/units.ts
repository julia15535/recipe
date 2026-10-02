// Единицы — к виду сайта: «ст л», «ст.л.», «1ст л», «столовая ложка» → «ст. л.». Порядок важен:
// «ст. л.» раньше «стак.», «кг» раньше «г». Неизвестная единица остаётся как написана (с предупреждением).
const END = String.raw`(?=$|[\s,;)])`;
const UNITS: readonly (readonly [string, RegExp])[] = [
  ["ст. л.", new RegExp(String.raw`^(?:ст\.?\s*л\.?|столов\S*\s+лож\S*)${END}`, "i")],
  ["ч. л.", new RegExp(String.raw`^(?:ч\.?\s*л\.?|чайн\S*\s+лож\S*)${END}`, "i")],
  ["кг", new RegExp(String.raw`^(?:кг\.?|килограм\S*)${END}`, "i")],
  ["мл", new RegExp(String.raw`^(?:мл\.?|миллилитр\S*)${END}`, "i")],
  ["г", new RegExp(String.raw`^(?:гр?\.?|грамм\S*)${END}`, "i")],
  ["л", new RegExp(String.raw`^(?:л\.?|литр\S*)${END}`, "i")],
  ["шт.", new RegExp(String.raw`^(?:шт\.?|штук\S*)${END}`, "i")],
  ["стак.", new RegExp(String.raw`^стак\S*${END}`, "i")],
  ["щеп.", new RegExp(String.raw`^щеп\S*${END}`, "i")],
  ["зуб.", new RegExp(String.raw`^зуб\S*${END}`, "i")],
  ["пуч.", new RegExp(String.raw`^пуч\S*${END}`, "i")],
];

export type UnitMatch = { unit: string | null; known: boolean; extra: string };

/** Единица в начале хвоста после числа и то, что осталось за ней (пойдёт в пометку). */
export function readUnit(tail: string): UnitMatch {
  const text = tail.trim();
  if (text === "") return { unit: null, known: true, extra: "" };
  // «Яйца — 2, крупные»: после числа сразу запятая — единицы нет, дальше пометка.
  if (/^[,;]/.test(text)) return { unit: null, known: true, extra: clean(text) };
  for (const [unit, pattern] of UNITS) {
    const match = pattern.exec(text);
    if (match) return { unit, known: true, extra: clean(text.slice(match[0].length)) };
  }
  const [word = "", ...rest] = text.split(/\s+/);
  return { unit: word.replace(/[,;]$/, ""), known: false, extra: clean(rest.join(" ")) };
}

/** Единица сразу в конце строки без разделителя («молоко 1ст л») — только известная. */
export function isKnownUnit(text: string): boolean {
  const match = readUnit(text);
  return match.known && match.unit !== null && match.extra === "";
}

function clean(text: string): string {
  return text.replace(/^[\s,;]+/, "").trim();
}
