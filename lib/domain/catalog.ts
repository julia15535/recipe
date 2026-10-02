// Коды каталога (стабильные, как в БД: sections.code, composition_tags.code) и слова, по которым их
// узнаёт разбор текста рецепта. Подписи и адреса — в БД; здесь только распознавание.
export const SECTION_CODES = [
  "breakfast",
  "soups",
  "salads",
  "hot",
  "sides",
  "starters",
  "baking",
  "desserts",
  "sauces",
  "drinks",
  "preserves",
] as const;
export type SectionCode = (typeof SECTION_CODES)[number];

export const TAG_CODES = ["protein", "fiber", "healthy-fats", "low-sugar", "iron"] as const;
export type TagCode = (typeof TAG_CODES)[number];

const SECTION_WORDS: Record<SectionCode, readonly string[]> = {
  breakfast: ["завтрак", "завтраки"],
  soups: ["суп", "супы"],
  salads: ["салат", "салаты"],
  hot: ["горячее", "горячие", "горячее блюдо", "горячие блюда", "основное блюдо"],
  sides: ["гарнир", "гарниры"],
  starters: ["закуска", "закуски"],
  baking: ["выпечка"],
  desserts: ["десерт", "десерты", "сладкое"],
  sauces: ["соус", "соусы"],
  drinks: ["напиток", "напитки"],
  preserves: ["заготовка", "заготовки"],
};

// «Без сахара» не тег (владелец 01.10: «без сахара не надо писать»).
const TAG_WORDS: Record<TagCode, readonly string[]> = {
  protein: ["белок", "белки", "белковое", "много белка"],
  fiber: ["клетчатка"],
  "healthy-fats": ["полезные жиры"],
  "low-sugar": ["мало сахара"],
  iron: ["железо"],
};

export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[.!?;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const lookup = <T extends string>(words: Record<T, readonly string[]>) =>
  new Map(Object.entries<readonly string[]>(words).flatMap(([code, list]) => list.map((word) => [normalizeWord(word), code as T])));
const SECTIONS = lookup(SECTION_WORDS);
const TAGS = lookup(TAG_WORDS);

export type CatalogWord = { kind: "section"; code: SectionCode } | { kind: "tag"; code: TagCode } | null;

/** «завтрак» → раздел «Завтраки», «белок» → тег «Белок»; иначе null. */
export function recognizeCatalogWord(word: string): CatalogWord {
  const key = normalizeWord(word);
  const section = SECTIONS.get(key);
  if (section) return { kind: "section", code: section };
  const tag = TAGS.get(key);
  return tag ? { kind: "tag", code: tag } : null;
}
