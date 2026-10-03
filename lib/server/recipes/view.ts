import "server-only";
import { and, asc, eq } from "drizzle-orm";

import type { RecipeView } from "@/components/recipe/view";
import { fraction } from "@/lib/domain/fraction";
import type { Quantity } from "@/lib/domain/quantity";
import type { WordForms } from "@/lib/domain/rescale";
import type { Executor } from "@/lib/server/db/client";
import { photoRefs } from "@/lib/server/media/photo-reads";
import * as t from "@/lib/server/db/schema";

// Сборка модели показа рецепта из строк БД — общая для кабинета и сайта. Статус здесь не проверяется:
// кабинет читает любой рецепт владельца, сайт сначала находит только опубликованный (public.ts).
type Head = { recipe: typeof t.recipes.$inferSelect; text: typeof t.recipeLocalizations.$inferSelect };

export async function buildView(db: Executor, { recipe, text }: Head, sectionHref: ((slug: string) => string) | null): Promise<RecipeView> {
  const id = recipe.id;
  const locale = text.locale;
  const [sections, tags, ingredients, steps, tips, photos] = await Promise.all([
    db
      .select({ code: t.sections.code, label: t.sectionLocalizations.label, slug: t.sectionLocalizations.slug })
      .from(t.recipeSections)
      .innerJoin(t.sections, eq(t.sections.id, t.recipeSections.sectionId))
      .innerJoin(t.sectionLocalizations, eq(t.sectionLocalizations.sectionId, t.sections.id))
      .where(and(eq(t.recipeSections.recipeId, id), eq(t.sectionLocalizations.locale, locale)))
      .orderBy(asc(t.recipeSections.position)),
    db
      .select({ id: t.compositionTags.code, label: t.compositionTagLocalizations.label })
      .from(t.recipeCompositionTags)
      .innerJoin(t.compositionTags, eq(t.compositionTags.id, t.recipeCompositionTags.tagId))
      .innerJoin(t.compositionTagLocalizations, eq(t.compositionTagLocalizations.tagId, t.compositionTags.id))
      .where(and(eq(t.recipeCompositionTags.recipeId, id), eq(t.compositionTagLocalizations.locale, locale)))
      .orderBy(asc(t.recipeCompositionTags.position)),
    db.select().from(t.recipeIngredients).where(eq(t.recipeIngredients.recipeId, id)).orderBy(asc(t.recipeIngredients.position)),
    db.select().from(t.recipeSteps).where(eq(t.recipeSteps.recipeId, id)).orderBy(asc(t.recipeSteps.position)),
    db.select().from(t.recipeTips).where(eq(t.recipeTips.recipeId, id)).orderBy(asc(t.recipeTips.position)),
    photoRefs(db, [id]),
  ]);
  return {
    title: text.title,
    description: text.description,
    time: text.timeText,
    yield: recipe.yieldNum && recipe.yieldDen ? { amount: fraction(recipe.yieldNum, recipe.yieldDen), forms: forms(text.yieldForms) } : null,
    sections: sections.map(({ code, label, slug }) => ({ code, label, href: sectionHref ? sectionHref(slug) : null })),
    tags,
    ingredients: ingredients.map((row) => ({
      id: row.id,
      name: row.displayName,
      quantity: quantityOf(row),
      unit: row.unit,
      note: row.note,
      ...(row.amountStyle ? { amountStyle: row.amountStyle } : {}),
    })),
    mainId: recipe.mainIngredientId,
    steps: steps.map((row) => ({ id: row.id, text: row.text })),
    tips: tips.map((row) => ({ id: row.id, text: row.text })),
    photo: photos.get(id) ?? null,
  };
}

function quantityOf(row: typeof t.recipeIngredients.$inferSelect): Quantity {
  const { quantityKind: kind, amountNum: num, amountDen: den, amountMaxNum: maxNum, amountMaxDen: maxDen } = row;
  if (kind === "exact" && num && den) return { kind, amount: fraction(num, den) };
  if (kind === "range" && num && den && maxNum && maxDen) return { kind, min: fraction(num, den), max: fraction(maxNum, maxDen) };
  return { kind: "none" };
}

const forms = (value: string[] | null): WordForms => {
  const [one = "порция", few = "порции", many = "порций"] = value ?? [];
  return [one, few, many];
};
