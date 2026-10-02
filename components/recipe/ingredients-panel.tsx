"use client";

import { useId } from "react";

import { AppButton } from "@/components/app-button";
import { Input } from "@/components/base/input/input";
import { type Fraction, fraction, mul } from "@/lib/domain/fraction";
import { type AmountCheck, MAX_FACTOR, formatAmount, formatInput, formatQuantity } from "@/lib/domain/rescale";
import { cx } from "@/utils/cx";

import type { RecipeView, ViewIngredient } from "./view";

type Props = {
  recipe: RecipeView;
  base: Fraction;
  factor: Fraction;
  raw: string;
  check: AmountCheck;
  onChange: (raw: string) => void;
  onReset: () => void;
};

// Список ингредиентов: у основного — поле «своё количество» (ADR-0016, без «−/+»), остальные
// пересчитываются от него (диапазон — с обеих сторон); без количества («по желанию») — как есть.
export function IngredientsPanel({ recipe, base, factor, raw, check, onChange, onReset }: Props) {
  return (
    <ul className="flex flex-col divide-y divide-secondary">
      {recipe.ingredients.map((item) =>
        item.id === recipe.mainId ? (
          <li key={item.id} className="py-3">
            <MainIngredient item={item} base={base} raw={raw} check={check} onChange={onChange} onReset={onReset} />
          </li>
        ) : (
          <li key={item.id} className="flex items-baseline justify-between gap-4 py-3 text-md">
            <span className="break-words text-secondary">{item.name}</span>
            <IngredientAmount item={item} factor={factor} />
          </li>
        ),
      )}
    </ul>
  );
}

// Число — жирным, пометка («по желанию», «если творог сухой») — обычным текстом; короткая пометка без
// числа не переносится.
function IngredientAmount({ item, factor }: { item: ViewIngredient; factor: Fraction }) {
  const amount = formatQuantity(item.quantity, factor, item.unit);
  return (
    <span className={cx("text-right", amount ? "" : "shrink-0 whitespace-nowrap")} data-testid="ingredient-amount">
      {amount && <span className="font-semibold whitespace-nowrap text-primary">{`${amount} ${item.unit ?? ""}`.trim()}</span>}
      {amount && item.note && <span className="text-tertiary">, {item.note}</span>}
      {!amount && <span className="text-tertiary">{item.note}</span>}
    </span>
  );
}

type MainProps = Omit<Props, "recipe" | "factor"> & { item: ViewIngredient };

// Строка основного ингредиента — как у остальных (владелец 02.10, макет): название слева, поле с
// единицей рядом; поле называется названием ингредиента (aria-labelledby).
function MainIngredient({ item, base, raw, check, onChange, onReset }: MainProps) {
  const hintId = useId();
  const nameId = useId();
  const hints: Record<Exclude<AmountCheck, { ok: true }>["reason"], string> = {
    empty: "Впишите количество",
    format: "Только число, например 250 или 2,5",
    zero: "Количество должно быть больше нуля",
    tooBig: `Слишком много — не больше ${formatAmount(mul(base, fraction(MAX_FACTOR)), item.unit)} ${item.unit ?? ""}`,
  };
  return (
    <div className="-mx-3 flex flex-col gap-2 rounded-2xl bg-accent-50 px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-md">
        <span id={nameId} className="break-words text-secondary">
          {item.name}
        </span>
        <div className="flex items-center gap-2">
          <Input
            aria-labelledby={nameId}
            value={raw}
            onChange={onChange}
            inputMode="decimal"
            size="lg"
            isInvalid={!check.ok}
            aria-describedby={hintId}
            className="w-32"
          />
          <span className="text-secondary">{item.unit}</span>
        </div>
      </div>
      <p id={hintId} aria-live="polite" className={cx("text-sm", check.ok ? "text-tertiary" : "text-error-primary")}>
        {check.ok ? "Основной ингредиент: впишите своё количество — остальное пересчитается." : hints[check.reason]}
      </p>
      {raw !== formatInput(base) && (
        <AppButton color="tertiary" onPress={onReset} className="self-start">
          Как в рецепте: {formatAmount(base, item.unit)} {item.unit}
        </AppButton>
      )}
    </div>
  );
}
