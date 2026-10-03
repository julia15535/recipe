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

// Теги состава (ADR-0019, ADR-0021): ставит автор; id стабильный — по нему цвет тега.
export const COMPOSITION_TAGS = [
  { id: "protein", label: "Белок" },
  { id: "fiber", label: "Клетчатка" },
  { id: "healthy-fats", label: "Полезные жиры" },
  { id: "low-sugar", label: "Мало сахара" },
  { id: "iron", label: "Железо" },
] as const;

export type CompositionTagId = (typeof COMPOSITION_TAGS)[number]["id"];

export const PROTOTYPE = {
  index: "/admin/ui",
  home: "/admin/ui/home",
  search: "/admin/ui/search",
  recipe: (slug: string) => `/admin/ui/recipe/${slug}`,
  // Страница раздела — сразу рецепты (владелец 01.10); на сайте — `/{locale}/catalog/{slug}` (ADR-0017).
  section: (id: SectionId) => `/admin/ui/section/${id}`,
};

// Все 11 мест каталога; раздел без рецептов — пустой (ADR-0020), текущий — отмечен.
export function catalogFor(active: ReadonlySet<SectionId>, current?: SectionId): CatalogSection[] {
  return SECTIONS.map(({ id, label }) => ({
    id,
    label,
    href: PROTOTYPE.section(id),
    empty: !active.has(id),
    current: id === current,
  }));
}

export const HEADER = {
  siteName: "Книга рецептов",
  signature: { text: "Юлианы", locale: "ru" as const },
  homeHref: PROTOTYPE.home,
  searchHref: PROTOTYPE.search,
  searchLabel: "Поиск",
  language: { href: "/en", label: "EN", name: "English", lang: "en" },
};

/** Теги рецепта в порядке автора — как на сайте (`lib/server/recipes/view.ts` по `position`), не каталога. */
export function compositionTags(ids: readonly CompositionTagId[]) {
  return ids.flatMap((id) => COMPOSITION_TAGS.filter((tag) => tag.id === id));
}

export function sectionLabel(id: SectionId): string {
  return SECTIONS.find((section) => section.id === id)?.label ?? id;
}

// Раздел приходит извне (адрес страницы раздела или ?section= поиска) — проверяем схемой.
const SectionParam = z.enum(SECTIONS.map(({ id }) => id) as [SectionId, ...SectionId[]]);

export function parseSectionId(value: unknown): SectionId | null {
  const result = SectionParam.safeParse(value);
  return result.success ? result.data : null;
}
