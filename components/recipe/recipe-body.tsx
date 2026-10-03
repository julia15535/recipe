"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { Tab, TabList, TabPanel, Tabs } from "@/components/application/tabs/tabs";
import { useLang } from "@/components/i18n/use-lang";
import { type Fraction, fraction, mul } from "@/lib/domain/fraction";
import { ONE, factorOf, formatInput, parseAmount, yieldLabel } from "@/lib/domain/rescale";

import { IngredientsPanel } from "./ingredients-panel";
import type { RecipeView } from "./view";

// Тело рецепта: вкладки «Рецепт / Приготовление» (решение владельца); выход — «~ N порций» у заголовка
// «Ингредиенты» (ADR-0021), если задан; пересчёт — от своего количества основного ингредиента (ADR-0016).
export function RecipeBody({ recipe, children }: { recipe: RecipeView; children: ReactNode }) {
  const t = useTranslations("Recipe");
  const lang = useLang();
  const main = recipe.ingredients.find((item) => item.id === recipe.mainId);
  const base: Fraction = main?.quantity.kind === "exact" ? main.quantity.amount : fraction(1);
  const [raw, setRaw] = useState(formatInput(base, lang));
  const [factor, setFactor] = useState(ONE);
  const check = parseAmount(raw, base);

  const change = (value: string) => {
    setRaw(value);
    const next = parseAmount(value, base);
    if (next.ok) setFactor(factorOf(next.value, base));
  };
  const reset = () => change(formatInput(base, lang));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-16 lg:pt-8">
      {children}
      <Tabs defaultSelectedKey="recipe">
        <TabList aria-label={t("tabs")} type="button-brand" size="md" fullWidth className="rounded-full bg-secondary p-1">
          <Tab id="recipe" className="min-h-11 rounded-full">
            {t("recipe")}
          </Tab>
          <Tab id="steps" className="min-h-11 rounded-full">
            {t("steps")}
          </Tab>
        </TabList>

        <TabPanel id="recipe" className="flex flex-col gap-2 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-display-xs text-primary">{t("ingredients")}</h2>
            {recipe.yield && (
              <p className="text-lg text-secondary" aria-live="polite" data-testid="servings">
                <span aria-hidden>~ </span>
                <span className="sr-only">{t("approx")}</span>
                {yieldLabel(mul(recipe.yield.amount, factor), recipe.yield.forms, lang)}
              </p>
            )}
          </div>
          <IngredientsPanel recipe={recipe} base={base} factor={factor} raw={raw} check={check} onChange={change} onReset={reset} />
        </TabPanel>

        <TabPanel id="steps" className="flex flex-col gap-8 pt-6">
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                  {index + 1}
                </span>
                <span className="pt-1 text-md break-words text-secondary">{step.text}</span>
              </li>
            ))}
          </ol>
          {recipe.tips.length > 0 && (
            <section aria-labelledby="recipe-tips" className="flex flex-col gap-3 rounded-2xl bg-accent-50 p-4">
              <h2 id="recipe-tips" className="font-display text-xl text-primary">
                {t("tips")}
              </h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-md text-secondary">
                {recipe.tips.map((tip) => (
                  <li key={tip.id} className="break-words">
                    {tip.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
