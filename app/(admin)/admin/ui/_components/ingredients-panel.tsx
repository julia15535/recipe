"use client";

import { useId } from "react";

import { AppButton } from "@/components/app-button";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";

import type { DemoIngredient, DemoRecipe } from "../_demo/demo-recipes";
import { type AmountCheck, MAX_FACTOR, formatAmount, formatInput } from "../_demo/demo-rescale";

type Props = {
  recipe: DemoRecipe;
  factor: number;
  raw: string;
  check: AmountCheck;
  onChange: (raw: string) => void;
  onReset: () => void;
};

// Список ингредиентов: у основного — поле «своё количество» (ADR-0016, без «−/+»), остальные
// пересчитываются от него. При неверном вводе — подсказка, числа остаются от последнего верного.
export function IngredientsPanel({ recipe, factor, raw, check, onChange, onReset }: Props) {
  return (
    <ul className="flex flex-col divide-y divide-secondary">
      {recipe.ingredients.map((item, index) =>
        index === recipe.main ? (
          <li key={item.name} className="py-3">
            <MainIngredient item={item} raw={raw} check={check} onChange={onChange} onReset={onReset} />
          </li>
        ) : (
          <li key={item.name} className="flex items-baseline justify-between gap-4 py-3 text-md">
            <span className="text-secondary">{item.name}</span>
            <span className="shrink-0 font-semibold text-primary">
              {formatAmount(item.amount * factor)} {item.unit}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

type MainProps = Omit<Props, "recipe" | "factor"> & { item: DemoIngredient };

function MainIngredient({ item, raw, check, onChange, onReset }: MainProps) {
  const hintId = useId();
  const hints: Record<Exclude<AmountCheck, { ok: true }>["reason"], string> = {
    empty: "Впишите количество",
    format: "Только число, например 250 или 2,5",
    zero: "Количество должно быть больше нуля",
    tooBig: `Слишком много — не больше ${formatAmount(item.amount * MAX_FACTOR)} ${item.unit}`,
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
      {raw !== formatInput(item.amount) && (
        <AppButton color="tertiary" onPress={onReset} className="self-start">
          Как в рецепте: {formatAmount(item.amount)} {item.unit}
        </AppButton>
      )}
    </div>
  );
}
