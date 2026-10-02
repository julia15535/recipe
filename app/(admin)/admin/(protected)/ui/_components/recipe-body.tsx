"use client";

import { type ReactNode, useState } from "react";

import { Tab, TabList, TabPanel, Tabs } from "@/components/application/tabs/tabs";

import { formatInput, parseAmount, yieldLabel } from "../_demo/demo-rescale";
import { type DemoRecipe, baseAmount } from "../_demo/demo-types";
import { IngredientsPanel } from "./ingredients-panel";

// Тело рецепта: вкладки «Рецепт / Приготовление» (решение владельца); выход — «~ N порций» справа от
// заголовка «Ингредиенты» (ADR-0021), если задан, меняется при вводе количества основного ингредиента (ADR-0016).
export function RecipeBody({ recipe, children }: { recipe: DemoRecipe; children: ReactNode }) {
  const base = baseAmount(recipe);
  const [raw, setRaw] = useState(formatInput(base));
  const [factor, setFactor] = useState(1);
  const check = parseAmount(raw, base);

  const change = (value: string) => {
    setRaw(value);
    const next = parseAmount(value, base);
    if (next.ok) setFactor(next.value / base);
  };
  const reset = () => change(formatInput(base));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-16 lg:pt-8">
      {children}
      <Tabs defaultSelectedKey="recipe">
        <TabList aria-label="Рецепт и приготовление" type="button-brand" size="md" fullWidth className="rounded-full bg-secondary p-1">
          <Tab id="recipe" className="min-h-11 rounded-full">
            Рецепт
          </Tab>
          <Tab id="steps" className="min-h-11 rounded-full">
            Приготовление
          </Tab>
        </TabList>

        <TabPanel id="recipe" className="flex flex-col gap-2 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-display-xs text-primary">Ингредиенты</h2>
            {recipe.yield && (
              <p className="text-lg text-secondary" aria-live="polite" data-testid="servings">
                <span aria-hidden>~ </span>
                <span className="sr-only">примерно </span>
                {yieldLabel(recipe.yield.amount * factor, recipe.yield.forms)}
              </p>
            )}
          </div>
          <IngredientsPanel recipe={recipe} factor={factor} raw={raw} check={check} onChange={change} onReset={reset} />
        </TabPanel>

        <TabPanel id="steps" className="pt-6">
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                  {index + 1}
                </span>
                <span className="pt-1 text-md text-secondary">{step}</span>
              </li>
            ))}
          </ol>
        </TabPanel>
      </Tabs>
    </div>
  );
}
