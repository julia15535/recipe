"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { AppButton } from "@/components/app-button";
import { Input } from "@/components/base/input/input";
import { useLang } from "@/components/i18n/use-lang";
import { type Fraction, fraction, mul, toNumber } from "@/lib/domain/fraction";
import type { Lang } from "@/lib/domain/lang";
import { type AmountCheck, MAX_FACTOR, formatAmount, formatInput } from "@/lib/domain/rescale";
import { showQuantity } from "@/lib/domain/rounding";
import { unitLabel } from "@/lib/domain/units";
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
  const lang = useLang();
  return (
    <ul className="flex flex-col divide-y divide-secondary">
      {recipe.ingredients.map((item) =>
        item.id === recipe.mainId ? (
          <li key={item.id} className="py-3">
            <MainIngredient item={item} base={base} raw={raw} check={check} onChange={onChange} onReset={onReset} lang={lang} />
          </li>
        ) : (
          <li key={item.id} className="flex items-baseline justify-between gap-4 py-3 text-md">
            <span className="break-words text-secondary">{item.name}</span>
            <IngredientAmount item={item} factor={factor} lang={lang} />
          </li>
        ),
      )}
    </ul>
  );
}

/** Количество с единицей на языке страницы: «250 г» / «250 g», «2 шт.» / «2». */
const withUnit = (amount: string, unit: string | null, lang: Lang, value: number, forms?: ViewIngredient["unitForms"]) =>
  [amount, unitLabel(unit, lang, value, forms)].filter(Boolean).join(" ");

// Число — жирным (после пересчёта — округлено и со значком ≈, `lib/domain/rounding.ts`), пометка («по желанию»,
// «если творог сухой») и подсказка — обычным текстом; короткая пометка без числа не переносится.
function IngredientAmount({ item, factor, lang }: { item: ViewIngredient; factor: Fraction; lang: Lang }) {
  const t = useTranslations("Recipe");
  const shown = showQuantity(item, factor, { lang, kind: item.kind });
  const value = item.quantity.kind === "exact" ? toNumber(mul(item.quantity.amount, factor)) : 2;
  const text = shown && (shown.special === "pinch" ? t("pinch") : withUnit(shown.amount, shown.unit, lang, value, item.unitForms));
  const amount = shown && `${shown.approx ? "≈ " : ""}${shown.special === "upTo" ? t("upTo", { amount: text ?? "" }) : text}`;
  const extra = [item.note, shown?.hint && t(shown.hint)].filter(Boolean).join(", ");
  return (
    <span className={cx("text-right", amount ? "" : "shrink-0 whitespace-nowrap")} data-testid="ingredient-amount">
      {amount && <span className="font-semibold whitespace-nowrap text-primary">{amount}</span>}
      {amount && extra && <span className="text-tertiary">, {extra}</span>}
      {!amount && <span className="text-tertiary">{item.note}</span>}
    </span>
  );
}

type MainProps = Omit<Props, "recipe" | "factor"> & { item: ViewIngredient; lang: Lang };

// Строка основного ингредиента — как у остальных (владелец 02.10, макет): название слева, поле с
// единицей рядом; поле называется названием ингредиента (aria-labelledby).
function MainIngredient({ item, base, raw, check, onChange, onReset, lang }: MainProps) {
  const t = useTranslations("Recipe");
  const hintId = useId();
  const nameId = useId();
  const limit = mul(base, fraction(MAX_FACTOR));
  const hints: Record<Exclude<AmountCheck, { ok: true }>["reason"], string> = {
    empty: t("empty"),
    format: t("format"),
    zero: t("zero"),
    tooBig: t("tooBig", { amount: withUnit(formatAmount(limit, lang), item.unit, lang, toNumber(limit), item.unitForms) }),
  };
  const unit = unitLabel(item.unit, lang, toNumber(base), item.unitForms);
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
          {unit && <span className="text-secondary">{unit}</span>}
        </div>
      </div>
      <p id={hintId} aria-live="polite" className={cx("text-sm", check.ok ? "text-tertiary" : "text-error-primary")}>
        {check.ok ? t("mainHint") : hints[check.reason]}
      </p>
      {raw !== formatInput(base, lang) && (
        <AppButton color="tertiary" onPress={onReset} className="self-start">
          {t("reset", { amount: withUnit(formatAmount(base, lang), item.unit, lang, toNumber(base), item.unitForms) })}
        </AppButton>
      )}
    </div>
  );
}
