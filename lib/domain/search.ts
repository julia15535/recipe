// Поиск по опубликованным рецептам — в браузере, по компактному индексу (план public-pages, ADR-0002: без ИИ).
// Нормализация одна для данных и запроса: NFKC, нижний регистр, «ё» → «е», лишние пробелы.

import { type Lang, NUMBER_LOCALE } from "./lang";

export type SearchMode = "recipe" | "ingredient";
// «перец / травы / паприка», «орехи или фундук» — отдельные таблетки; союз — на языке рецептов.
const OR: Record<Lang, RegExp> = { ru: /\s*\/\s*|\s+или\s+/i, en: /\s*\/\s*|\s+or\s+/i };
export type SearchQuery = { mode: SearchMode; text: string; ingredients: string[]; section: string | null; tags: string[] };
export type Searchable = { title: string; ingredients: readonly string[]; sections: readonly string[]; tags: readonly string[] };

export function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
}

/**
 * «Таблетки» ингредиентов из названий строк: без уточнений в скобках, процентов и чисел; «перец / травы / паприка»
 * и «орехи или фундук» — отдельными; после запятой — уточнение, не берём. «Творог 0,5%» → «Творог».
 */
export function ingredientChips(names: readonly string[], lang: Lang = "ru"): string[] {
  const seen = new Map<string, string>();
  for (const name of names) {
    for (const part of name.replace(/\([^)]*\)/g, " ").split(",")[0]?.split(OR[lang]) ?? []) {
      const clean = part.replace(/\d+([.,]\d+)?\s*%?/g, " ").replace(/\s+/g, " ").trim();
      if (clean.length < 2) continue;
      const key = normalize(clean);
      if (!seen.has(key)) seen.set(key, clean.charAt(0).toUpperCase() + clean.slice(1));
    }
  }
  return [...seen.values()].sort(new Intl.Collator(NUMBER_LOCALE[lang]).compare);
}

/**
 * «Таблетки» всех рецептов по частоте: сначала ингредиенты, что встречаются в большем числе рецептов (их и
 * показываем первыми, пока поле пустое), при равенстве — по алфавиту. «Черный»/«Чёрный» — одна таблетка.
 */
export function rankedChips(recipes: readonly (readonly string[])[], lang: Lang = "ru"): string[] {
  const found = new Map<string, { label: string; count: number }>();
  const collator = new Intl.Collator(NUMBER_LOCALE[lang]);
  for (const names of recipes) {
    for (const label of ingredientChips(names, lang)) {
      const key = normalize(label);
      const entry = found.get(key);
      if (entry) entry.count += 1;
      else found.set(key, { label, count: 1 });
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count || collator.compare(a.label, b.label)).map((entry) => entry.label);
}

export function hasCriteria(query: SearchQuery): boolean {
  const main = query.mode === "recipe" ? query.text.trim() !== "" : query.ingredients.length > 0;
  return main || query.section !== null || query.tags.length > 0;
}

/** Все условия — «И»: название (или каждый выбранный ингредиент), раздел, каждый тег. */
export function matches(recipe: Searchable, query: SearchQuery): boolean {
  const text = normalize(query.text);
  const names = recipe.ingredients.map(normalize);
  return (
    (query.mode !== "recipe" || normalize(recipe.title).includes(text)) &&
    (query.mode !== "ingredient" || query.ingredients.every((chip) => names.some((name) => name.includes(normalize(chip))))) &&
    (query.section === null || recipe.sections.includes(query.section)) &&
    query.tags.every((tag) => recipe.tags.includes(tag))
  );
}

/** Состояние поиска ↔ адрес: `by`, `q`, повторяемые `i` и `tag`, `section`. Неизвестное отбрасывается. */
export function queryFromParams(params: URLSearchParams, sections: readonly string[], tags: readonly string[]): SearchQuery {
  const by = params.get("by");
  const section = params.get("section");
  return {
    mode: by === "ingredient" ? "ingredient" : "recipe",
    text: (params.get("q") ?? "").slice(0, 100),
    ingredients: [...new Set(params.getAll("i").map((item) => item.slice(0, 60)).filter(Boolean))].slice(0, 10),
    section: section && sections.includes(section) ? section : null,
    tags: [...new Set(params.getAll("tag"))].filter((tag) => tags.includes(tag)),
  };
}

export function paramsFromQuery(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.mode === "ingredient") params.set("by", "ingredient");
  if (query.text.trim()) params.set("q", query.text.trim());
  for (const item of [...query.ingredients].sort()) params.append("i", item);
  if (query.section) params.set("section", query.section);
  for (const tag of [...query.tags].sort()) params.append("tag", tag);
  const text = params.toString();
  return text ? `?${text}` : "";
}
