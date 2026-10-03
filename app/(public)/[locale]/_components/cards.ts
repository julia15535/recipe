import type { CardData } from "@/components/recipe/recipe-card";
import type { SearchEntry } from "@/components/search/recipe-search";
import { type Locale, recipePath } from "@/lib/server/recipes/public";
import type { PublicCard, SearchItem } from "@/lib/server/recipes/public-lists";

// Публичные DTO → данные карточек и поиска (адрес рецепта готовим здесь, компоненты о локалях не знают).
export function toCards(locale: Locale, cards: PublicCard[]): CardData[] {
  return cards.map((card) => ({ href: recipePath(locale, card.slug), title: card.title, time: card.time, section: card.section, photo: card.photo, tag: card.tag }));
}

export function toSearchEntries(locale: Locale, items: SearchItem[]): SearchEntry[] {
  return items.map((item) => ({
    href: recipePath(locale, item.slug),
    title: item.title,
    time: item.time,
    section: item.section,
    photo: item.photo,
    tag: item.tag,
    ingredients: item.ingredients,
    sections: item.sections,
    tagCodes: item.tagCodes,
  }));
}
