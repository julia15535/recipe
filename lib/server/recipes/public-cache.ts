import "server-only";
import { cacheLife, cacheTag, updateTag } from "next/cache";

import { type Locale, readCatalog, readPublicRecipe } from "./public";
import { readCards, readSearchIndex } from "./public-lists";

// Кэш публичного сайта (ADR-0013, план public-pages). Вызывать только после `await io()` под <Suspense>:
// сборка образа идёт без БД, и чтение не должно попасть в статическую оболочку. После любой правки владельца
// кабинет сбрасывает все теги сразу (`PUBLIC_TAGS`, `updateTag`) — сайт маленький, так проще и надёжнее.
export const PUBLIC_TAGS = ["recipes", "catalog", "search-index"] as const;
export const recipeTag = (id: string) => `recipe:${id}`;

// Сервер держит данные до сброса тегами (или час); браузер посетителя без проверки сервера — 30 с (минимум Next):
// снятый рецепт у того, кто его уже открывал, пропадает не позже чем через 30 с (критика Codex 02.10).
const LIFE = { stale: 30, revalidate: 3600, expire: 86400 };

/** Только из действий кабинета (Server Actions) после успешной записи: сайт сразу показывает новое. */
export function refreshPublicSite(): void {
  for (const tag of PUBLIC_TAGS) updateTag(tag);
}

export async function cachedCatalog(locale: Locale) {
  "use cache";
  cacheTag("catalog", "recipes");
  cacheLife(LIFE);
  return readCatalog(locale);
}

export async function cachedNewRecipes(locale: Locale) {
  "use cache";
  cacheTag("recipes");
  cacheLife(LIFE);
  return readCards(locale, { limit: 12 });
}

export async function cachedSectionRecipes(locale: Locale, sectionCode: string) {
  "use cache";
  cacheTag("recipes", "catalog");
  cacheLife(LIFE);
  return readCards(locale, { sectionCode });
}

export async function cachedSearchIndex(locale: Locale) {
  "use cache";
  cacheTag("search-index", "recipes");
  cacheLife(LIFE);
  return readSearchIndex(locale);
}

export async function cachedRecipe(locale: Locale, slug: string) {
  "use cache";
  cacheTag("recipes");
  cacheLife(LIFE);
  const recipe = await readPublicRecipe(locale, slug);
  if (recipe) cacheTag(recipeTag(recipe.id));
  return recipe;
}
