// Замечания к ИИ-разбору, которые ставит наш код, а не модель (план ai-ingredients-from-list, владелец 03.10):
// «списка не было» — по ответу ИИ `ingredients_source`; повтор ингредиента — сравнением названий. Оба — `note`:
// сохранить не мешают, автор решает сама.
import type { AiRecipe, Check } from "./ai-recipe";
import type { ParsedIngredient } from "./parse";

export const NO_LIST = "Списка ингредиентов не было — ингредиенты собраны из текста; проверьте состав и количества.";

export function sourceNote(ai: AiRecipe): Check[] {
  return ai.result_type === "recipe" && ai.ingredients_source === "text" ? [{ group: "note", text: NO_LIST }] : [];
}

// Назначение различает строки («сахар в тесто» / «сахар в крем», «масло для жарки»); условие («если масса мягкая»,
// «по желанию») — нет: условная добавка того же ингредиента и есть лишняя вторая строка.
const PURPOSE = /(?:^|\s)(?:в|во|для|на|к)\s+\p{L}+/u;
const CONDITION = /^(?:если|при\s|по\s|ещ|дополнительно)/;
// Осторожно, без общего стемминга (совет Codex 03.10): только явные пары форм.
const ALIASES: Record<string, string> = { яйца: "яйцо" };

const plain = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}()\s%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Название → «основа» и уточнение (скобки автора и назначение из названия или пометки). */
function identity(item: ParsedIngredient): { base: string; detail: string } {
  const name = plain(item.name);
  const brackets = [...name.matchAll(/\(([^)]*)\)/g)].map((match) => (match[1] ?? "").trim()).filter((text) => !CONDITION.test(text));
  const bare = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const purpose = PURPOSE.exec(bare);
  const base = (purpose ? bare.slice(0, purpose.index) : bare).trim();
  const noteText = item.note ? plain(item.note) : "";
  // В пометке назначение — только с начала («для жарки», «в тесто»); «добавить в конце» — не назначение.
  const notePurpose = /^(?:в|во|для|на|к)\s+\p{L}+/u.exec(noteText)?.[0] ?? "";
  const detail = [...brackets, purpose?.[0].trim() ?? "", notePurpose].filter(Boolean).sort().join(" | ");
  return { base: ALIASES[base] ?? base, detail };
}

/** Одно и то же название в нескольких строках — замечание; разные уточнения у строк — законный повтор. */
export function repeatNotes(ingredients: readonly ParsedIngredient[]): Check[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const item of ingredients) {
    const { base, detail } = identity(item);
    if (!base) continue;
    const key = `${base}\u0000${detail}`;
    const entry = seen.get(key);
    seen.set(key, { name: entry?.name ?? item.name, count: (entry?.count ?? 0) + 1 });
  }
  return [...seen.values()]
    .filter((entry) => entry.count > 1)
    .map((entry) => ({
      group: "note" as const,
      text: `«${entry.name}» есть в списке ${entry.count} ${entry.count < 5 ? "раза" : "раз"} — проверьте, ${entry.count === 2 ? "нужны ли обе строки" : "нужны ли все строки"}.`,
    }));
}
