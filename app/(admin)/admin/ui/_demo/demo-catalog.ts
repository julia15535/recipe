import { z } from "zod";

import type { CatalogSection } from "@/components/catalog/types";

// Демо-данные прототипов (план home-and-recipe-screens). Настоящий источник разделов и тегов — БД
// (план схемы); здесь только то, что нужно владельцу, чтобы посмотреть экраны «руками».

// 11 верхних разделов каталога (ADR-0018); id стабильный, по нему — иконка раздела.
export const SECTIONS = [
  { id: "breakfast", label: "Завтраки" },
  { id: "soups", label: "Супы" },
  { id: "salads", label: "Салаты" },
  { id: "hot", label: "Горячее" },
  { id: "sides", label: "Гарниры" },
  { id: "starters", label: "Закуски" },
  { id: "baking", label: "Выпечка" },
  { id: "desserts", label: "Десерты" },
  { id: "sauces", label: "Соусы" },
  { id: "drinks", label: "Напитки" },
  { id: "preserves", label: "Заготовки" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

// Теги состава (ADR-0019): ставит автор, это не расчёт КБЖУ.
export const COMPOSITION_TAGS = ["Белок", "Клетчатка", "Полезные жиры", "Мало сахара", "Железо"] as const;

export type CompositionTag = (typeof COMPOSITION_TAGS)[number];

export const PROTOTYPE = {
  index: "/admin/ui",
  home: "/admin/ui/home",
  search: "/admin/ui/search",
  recipe: (slug: string) => `/admin/ui/recipe/${slug}`,
  // Страниц разделов в прототипе нет (ADR-0017: появятся со схемой БД) — раздел открывает поиск с уточнением.
  section: (id: SectionId) => `/admin/ui/search?section=${id}`,
};

export const CATALOG: CatalogSection[] = SECTIONS.map(({ id, label }) => ({ id, label, href: PROTOTYPE.section(id) }));

export const CATALOG_LABELS = { catalog: "Каталог", close: "Закрыть" };

export const HEADER = {
  siteName: "Книга рецептов",
  homeHref: PROTOTYPE.home,
  searchHref: PROTOTYPE.search,
  searchLabel: "Поиск",
  language: { href: "/en", label: "EN", name: "English", lang: "en" },
};

export function sectionLabel(id: SectionId): string {
  return SECTIONS.find((section) => section.id === id)?.label ?? id;
}

// Раздел приходит извне (адрес ?section=…) — проверяем схемой.
const SectionParam = z.enum(SECTIONS.map(({ id }) => id) as [SectionId, ...SectionId[]]);

export function parseSectionId(value: unknown): SectionId | null {
  const result = SectionParam.safeParse(value);
  return result.success ? result.data : null;
}
