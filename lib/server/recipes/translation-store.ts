import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { slugify } from "@/lib/domain/recipe-text/slug";
import { kindOf } from "@/lib/domain/rounding";
import { type SourceRecipe, TRANSLATION_SCHEMA_VERSION, type TranslationBody, type TranslationHead } from "@/lib/domain/translation";
import type { Executor } from "@/lib/server/db/client";
import { isUniqueViolation } from "@/lib/server/db/errors";
import * as t from "@/lib/server/db/schema";

import { buildView } from "./view";

// Снимок русского рецепта для перевода и запись готового перевода (ADR-0029). Вызывается внутри транзакций
// `translation-jobs.ts`; здесь — только чтение и запись строк.

/** Русский рецепт целиком на момент постановки перевода; null — рецепта нет. */
export async function sourceSnapshot(tx: Executor, recipeId: string): Promise<{ source: SourceRecipe; contentRevision: number } | null> {
  const [head] = await tx
    .select({ recipe: t.recipes, text: t.recipeLocalizations })
    .from(t.recipes)
    .innerJoin(t.recipeLocalizations, and(eq(t.recipeLocalizations.recipeId, t.recipes.id), eq(t.recipeLocalizations.locale, "ru")))
    .where(eq(t.recipes.id, recipeId));
  if (!head) return null;
  const view = await buildView(tx, head, null);
  const source: SourceRecipe = {
    schemaVersion: TRANSLATION_SCHEMA_VERSION,
    title: view.title,
    description: view.description,
    time: view.time,
    yield: view.yield && { amount: view.yield.amount, forms: [...view.yield.forms] },
    sectionCodes: view.sections.map((section) => section.code),
    primarySectionCode: view.sections[0]?.code ?? "",
    tagCodes: view.tags.map((tag) => tag.id),
    mainId: view.mainId,
    ingredients: view.ingredients.map((row) => ({
      id: row.id,
      name: row.name,
      note: row.note,
      quantity: row.quantity,
      unit: row.unit,
      kind: kindOf(row),
      ...(row.amountStyle ? { amountStyle: row.amountStyle } : {}),
    })),
    steps: view.steps,
    tips: view.tips,
  };
  return { source, contentRevision: head.recipe.contentRevision };
}

type Saved = { head: TranslationHead; body: TranslationBody; sourceContentRevision: number; model: string; promptVersion: string };

/** Перевод: английская локализация и снимок вместе. Адрес при повторном переводе не меняется (ссылки живут). */
export async function writeTranslation(tx: Executor, recipeId: string, saved: Saved): Promise<string> {
  const { head } = saved;
  const text = { title: head.title, description: head.description, timeText: head.time, yieldForms: head.yieldForms ? [...head.yieldForms] : null };
  const [current] = await tx
    .select({ slug: t.recipeLocalizations.slug })
    .from(t.recipeLocalizations)
    .where(and(eq(t.recipeLocalizations.recipeId, recipeId), eq(t.recipeLocalizations.locale, "en")));
  let slug = current?.slug;
  if (slug) {
    await tx.update(t.recipeLocalizations).set(text).where(and(eq(t.recipeLocalizations.recipeId, recipeId), eq(t.recipeLocalizations.locale, "en")));
  } else {
    slug = await insertWithFreeSlug(tx, recipeId, slugify(head.title) ?? `recipe-${recipeId.slice(0, 8)}`, text);
  }
  const row = { body: saved.body, schemaVersion: TRANSLATION_SCHEMA_VERSION, sourceContentRevision: saved.sourceContentRevision, model: saved.model, promptVersion: saved.promptVersion };
  await tx
    .insert(t.recipeTranslations)
    .values({ recipeId, locale: "en", ...row })
    .onConflictDoUpdate({ target: [t.recipeTranslations.recipeId, t.recipeTranslations.locale], set: { ...row, translatedAt: sql`now()` } });
  return slug;
}

async function insertWithFreeSlug(tx: Executor, recipeId: string, base: string, text: Record<string, unknown>): Promise<string> {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const slug = `${base.slice(0, 80 - suffix.length).replace(/-+$/, "")}${suffix}`;
    try {
      await tx.transaction((savepoint) => savepoint.insert(t.recipeLocalizations).values({ recipeId, locale: "en", slug, title: "", ...text }));
      return slug;
    } catch (error) {
      if (!isUniqueViolation(error, "recipe_localizations_locale_slug_unique")) throw error;
    }
  }
  throw new Error("не нашли свободный английский адрес рецепта за 50 попыток");
}
