import "server-only";
import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { slugify } from "@/lib/domain/recipe-text/slug";
import type { ParseResult } from "@/lib/domain/recipe-text/parse";
import { type Executor, getDb } from "@/lib/server/db/client";
import { guarded, isUniqueViolation } from "@/lib/server/db/errors";
import {
  recipeCompositionTags,
  recipeIngredients,
  recipeLocalizations,
  recipes,
  recipeSections,
  recipeSteps,
} from "@/lib/server/db/schema";

import { getCatalog } from "./catalog";
import { buildRows, type RecipeRows } from "./rows";

export type SaveOutcome = { ok: true; id: string; revision: number } | { ok: false; reason: "conflict" | "not-found" };
type Parsed = ParseResult & { mainIndex: number };

/** Новый рецепт одной транзакцией; slug — транслит названия, при совпадении `-2`, `-3`… */
export function createRecipe(parsed: Parsed, sourceText: string, status: "draft" | "published"): Promise<SaveOutcome> {
  const id = randomUUID();
  return guarded("рецепты", () =>
    getDb().transaction(async (tx) => {
      const rows = buildRows(id, parsed.draft, parsed.mainIndex, await getCatalog(tx));
      const publishedAt = status === "published" ? sql`now()` : null;
      await tx.insert(recipes).values({ id, status, sourceText, ...rows.recipe, publishedAt });
      await insertWithFreeSlug(tx, id, rows, slugify(parsed.draft.title) ?? `recipe-${id.slice(0, 8)}`);
      await insertChildren(tx, rows);
      return { ok: true, id, revision: 1 } as const;
    }),
  );
}

/** Замена текста целиком: адрес и статус не меняются; устаревшая вкладка (другая revision) — конфликт. */
export function replaceRecipe(id: string, expectedRevision: number, parsed: Parsed, sourceText: string): Promise<SaveOutcome> {
  return guarded("рецепты", () =>
    getDb().transaction(async (tx) => {
      const rows = buildRows(id, parsed.draft, parsed.mainIndex, await getCatalog(tx));
      const [updated] = await tx
        .update(recipes)
        .set({ sourceText, ...rows.recipe, revision: sql`${recipes.revision} + 1`, updatedAt: sql`now()` })
        .where(and(eq(recipes.id, id), eq(recipes.revision, expectedRevision)))
        .returning({ revision: recipes.revision });
      if (!updated) {
        const [exists] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id));
        return { ok: false, reason: exists ? "conflict" : "not-found" } as const;
      }
      await tx
        .update(recipeLocalizations)
        .set(rows.localization)
        .where(and(eq(recipeLocalizations.recipeId, id), eq(recipeLocalizations.locale, "ru")));
      for (const table of [recipeSections, recipeCompositionTags, recipeIngredients, recipeSteps]) {
        await tx.delete(table).where(eq(table.recipeId, id));
      }
      await insertChildren(tx, rows);
      return { ok: true, id, revision: updated.revision } as const;
    }),
  );
}

async function insertWithFreeSlug(tx: Executor, recipeId: string, rows: RecipeRows, base: string): Promise<void> {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const slug = `${base.slice(0, 80 - suffix.length).replace(/-+$/, "")}${suffix}`;
    try {
      await tx.transaction((savepoint) => savepoint.insert(recipeLocalizations).values({ recipeId, locale: "ru", slug, ...rows.localization }));
      return;
    } catch (error) {
      if (!isUniqueViolation(error, "recipe_localizations_locale_slug_unique")) throw error;
    }
  }
  throw new Error("не нашли свободный адрес рецепта за 50 попыток");
}

async function insertChildren(tx: Executor, rows: RecipeRows): Promise<void> {
  await tx.insert(recipeSections).values(rows.sections);
  if (rows.tags.length) await tx.insert(recipeCompositionTags).values(rows.tags);
  await tx.insert(recipeIngredients).values(rows.ingredients);
  await tx.insert(recipeSteps).values(rows.steps);
}
