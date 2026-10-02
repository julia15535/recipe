// Модель показа рецепта — одна для предпросмотра в кабинете, сохранённого рецепта и (адаптером)
// прототипов `/admin/ui`: дроби — точные, у строк — стабильные id, ссылки и подписи — готовые.
import type { Fraction } from "@/lib/domain/fraction";
import type { Quantity } from "@/lib/domain/quantity";
import type { WordForms } from "@/lib/domain/rescale";

export type ViewIngredient = { id: string; name: string; quantity: Quantity; unit: string | null; note: string | null };

export type RecipeView = {
  title: string;
  description: string | null;
  time: string | null;
  yield: { amount: Fraction; forms: WordForms } | null;
  sections: { code: string; label: string; href: string | null }[];
  tags: { id: string; label: string }[];
  ingredients: ViewIngredient[];
  /** Основной ингредиент — якорь пересчёта (ADR-0016); null — в предпросмотре с ошибкой. */
  mainId: string | null;
  steps: { id: string; text: string }[];
  /** Советы автора — отдельным блоком после шагов. */
  tips: { id: string; text: string }[];
  /** Только прототипы: цветная заглушка фото. У настоящих рецептов фото пока нет. */
  tone?: string;
};

export type CatalogLabels = { sections: ReadonlyMap<string, string>; tags: ReadonlyMap<string, string> };
