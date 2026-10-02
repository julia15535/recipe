// Деление текста на блоки: шапка (название, описание, «Теги:» …) → «Ингредиенты:» → «Приготовление:»
// (→ «Советы:»). Правила строк ингредиентов действуют только в своём блоке: «5–7 минут» в шагах — текст.
import { MARKER } from "./ingredient-line";

export type Line = { n: number; text: string };
export type KeyLine = { key: string; value: string; line: Line };
export type Blocks = { title: Line | null; description: Line[]; keys: KeyLine[]; ingredients: Line[]; steps: Line[]; tips: Line[] };

// Заголовок блока — один на строке или с текстом после двоеточия («Приготовление: 1. Творог…»).
const HEADERS = {
  ingredients: /^(?:ингредиенты|состав|продукты)\s*(?::\s*(.*))?$/i,
  steps: /^(?:приготовление|способ приготовления|как готовить|как приготовить|шаги)\s*(?::\s*(.*))?$/i,
  tips: /^(?:советы|совет)\s*(?::\s*(.*))?$/i,
} as const;
const KEY = /^(название|рецепт|теги|тег|разделы|раздел|категории|категория|описание|время приготовления|время|выход|порции|порций)\s*:\s*(.*)$/i;

export function splitBlocks(text: string): Blocks {
  const blocks: Blocks = { title: null, description: [], keys: [], ingredients: [], steps: [], tips: [] };
  let mode: "head" | keyof typeof HEADERS = "head";
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = { n: index + 1, text: raw.replace(/\t/g, " ").trim() };
    if (!line.text) return;
    const header = (Object.keys(HEADERS) as (keyof typeof HEADERS)[]).find((name) => HEADERS[name].test(line.text));
    if (header) {
      mode = header;
      const rest = HEADERS[header].exec(line.text)?.[1]?.trim();
      if (rest) blocks[header].push({ n: line.n, text: rest });
      return;
    }
    const key = mode === "steps" ? null : KEY.exec(line.text);
    if (key) {
      blocks.keys.push({ key: (key[1] ?? "").toLowerCase(), value: (key[2] ?? "").trim(), line });
      return;
    }
    if (mode !== "head") {
      blocks[mode].push(line);
      return;
    }
    if (!blocks.title) blocks.title = line;
    else if (MARKER.test(line.text) && blocks.ingredients.length === 0) [mode, blocks.ingredients] = ["ingredients", [line]];
    else blocks.description.push(line);
  });
  return blocks;
}
