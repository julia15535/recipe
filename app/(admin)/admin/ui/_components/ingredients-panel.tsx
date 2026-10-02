"use client";

import { useId } from "react";

import { AppButton } from "@/components/app-button";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";

import { type AmountCheck, MAX_FACTOR, formatAmount, formatInput, formatQuantity } from "../_demo/demo-rescale";
import { type DemoIngredient, type DemoRecipe, baseAmount } from "../_demo/demo-types";

type Props = {
  recipe: DemoRecipe;
  factor: number;
  raw: string;
  check: AmountCheck;
  onChange: (raw: string) => void;
  onReset: () => void;
};

// Список ингредиентов: у основного — поле «своё количество» (ADR-0016, без «−/+»), остальные
// пересчитываются от него (диапазон — с обеих сторон); «по желанию» без количества не пересчитывается.
// При неверном вводе — подсказка, числа остаются от последнего верного.
export function IngredientsPanel({ recipe, factor, raw, check, onChange, onReset }: Props) {
  return (
    <ul className="flex flex-col divide-y divide-secondary">
      {recipe.ingredients.map((item, index) =>
        index === recipe.main ? (
          <li key={item.name} className="py-3">
            <MainIngredient item={item} base={baseAmount(recipe)} raw={raw} check={check} onChange={onChange} onReset={onReset} />
          </li>
        ) : (
          <li key={item.name} className="flex items-baseline justify-between gap-4 py-3 text-md">
            <span className="text-secondary">{item.name}</span>
            <IngredientAmount item={item} factor={factor} />
          </li>
        ),
      )}
    </ul>
  );
}

function IngredientAmount({ item, factor }: { item: DemoIngredient; factor: number }) {
  const amount = formatQuantity(item.quantity, factor, item.unit);
  const parts = [amount && `${amount} ${item.unit ?? ""}`.trim(), item.note].filter(Boolean);
  return <span className={cx("shrink-0 text-right", amount ? "font-semibold text-primary" : "text-tertiary")}>{parts.join(", ")}</span>;
}

type MainProps = Omit<Props, "recipe" | "factor"> & { item: DemoIngredient; base: number };

function MainIngredient({ item, base, raw, check, onChange, onReset }: MainProps) {
  const hintId = useId();
  const hints: Record<Exclude<AmountCheck, { ok: true }>["reason"], string> = {
    empty: "Впишите количество",
    format: "Только число, например 250 или 2,5",
    zero: "Количество должно быть больше нуля",
    tooBig: `Слишком много — не больше ${formatAmount(base * MAX_FACTOR, item.unit)} ${item.unit ?? ""}`,
  };
  return (
    <div className="-mx-3 flex flex-col gap-2 rounded-2xl bg-accent-50 px-3 py-3">
      <div className="flex items-end gap-2">
        <Input
          label={item.name}
          value={raw}
          onChange={onChange}
          inputMode="decimal"
          size="lg"
          isInvalid={!check.ok}
          aria-describedby={hintId}
          className="w-40"
        />
        <span className="pb-3 text-md text-secondary">{item.unit}</span>
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
