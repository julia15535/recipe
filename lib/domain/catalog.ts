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

// Порядок — как в фильтре поиска (composition_tags.position, миграция 0011).
export const TAG_CODES = ["protein", "fiber", "healthy-fats", "omega-3", "low-sugar", "iron", "antioxidants"] as const;
export type TagCode = (typeof TAG_CODES)[number];
export const isTagCode = (code: string): code is TagCode => (TAG_CODES as readonly string[]).includes(code);

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

// «Без сахара» не тег (владелец 01.10: «без сахара не надо писать»). Просто «омега» — не тег: бывает омега-6 и омега-9.
const TAG_WORDS: Record<TagCode, readonly string[]> = {
  protein: ["белок", "белки", "белковое", "много белка"],
  fiber: ["клетчатка"],
  "healthy-fats": ["полезные жиры"],
  "omega-3": ["омега-3", "омега 3", "омега3"],
  "low-sugar": ["мало сахара"],
  iron: ["железо"],
  antioxidants: ["антиоксиданты", "антиоксидант"],
};

export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    // Дефисы и тире из текстовых редакторов («омега‑3», «омега–3») — обычный дефис.
    .replace(/[\u2010-\u2015\u2212]/gu, "-")
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
