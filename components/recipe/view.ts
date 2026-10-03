// Модель показа рецепта — одна для предпросмотра в кабинете, сохранённого рецепта и (адаптером)
// прототипов `/admin/ui`: дроби — точные, у строк — стабильные id, ссылки и подписи — готовые.
import type { Fraction } from "@/lib/domain/fraction";
import type { PhotoRef } from "@/lib/domain/photo";
import type { Quantity } from "@/lib/domain/quantity";
import type { Kind } from "@/lib/domain/rounding";
import type { WordForms } from "@/lib/domain/rescale";

/** `unit` — русский код единицы (и в переводе); `kind` и `unitForms` — из перевода: вид строки для округления и
 * английские формы авторской единицы (ADR-0029). */
export type ViewIngredient = {
  id: string;
  name: string;
  quantity: Quantity;
  unit: string | null;
  note: string | null;
  kind?: Kind;
  unitForms?: readonly [one: string, other: string] | null;
};

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
  /** Фото блюда (ADR-0028): кадр 4:3, готовые ширины; null — фото нет. */
  photo: PhotoRef | null;
  /** Только прототипы: цветная заглушка фото. */
  tone?: string;
};

export type CatalogLabels = { sections: ReadonlyMap<string, string>; tags: ReadonlyMap<string, string> };
