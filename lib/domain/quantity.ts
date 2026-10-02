import type { Fraction } from "./fraction";

// Количество строки ингредиента: точное, диапазон («½–1 ч. л.») или нет («по желанию» — пометка).
// Основной ингредиент — только точное (ADR-0016).
export type Quantity =
  | { kind: "exact"; amount: Fraction }
  | { kind: "range"; min: Fraction; max: Fraction }
  | { kind: "none" };
