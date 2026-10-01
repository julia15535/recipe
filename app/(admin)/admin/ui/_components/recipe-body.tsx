"use client";

import { type ReactNode, useState } from "react";

import { Tab, TabList, TabPanel, Tabs } from "@/components/application/tabs/tabs";
import { cx } from "@/utils/cx";

import type { DemoRecipe } from "../_demo/demo-recipes";
import { formatInput, parseAmount, servingsLabel } from "../_demo/demo-rescale";
import { IngredientsPanel } from "./ingredients-panel";

// Тело рецепта: вкладки «Рецепт / Приготовление» (решение владельца) и порции — справа на компьютере,
// под ингредиентами на телефоне. Состояние пересчёта одно на оба места.
export function RecipeBody({ recipe, children }: { recipe: DemoRecipe; children: ReactNode }) {
  const base = recipe.ingredients[recipe.main]?.amount ?? 1;
  const [raw, setRaw] = useState(formatInput(base));
  const [factor, setFactor] = useState(1);
  const check = parseAmount(raw, base);

  const change = (value: string) => {
    setRaw(value);
    const next = parseAmount(value, base);
    if (next.ok) setFactor(next.value / base);
  };
  const reset = () => change(formatInput(base));
  const servings = recipe.servings * factor;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-4 pb-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 lg:px-8 lg:pt-8">
      <div className="flex min-w-0 flex-col gap-6">
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
            <h2 className="font-display text-display-xs text-primary">Ингредиенты</h2>
            <IngredientsPanel recipe={recipe} factor={factor} raw={raw} check={check} onChange={change} onReset={reset} />
            <ServingsCard servings={servings} className="mt-4 lg:hidden" />
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

      <aside aria-label="Порции" className="max-lg:hidden">
        <ServingsCard servings={servings} className="sticky top-6" />
      </aside>
    </div>
  );
}

function ServingsCard({ servings, className }: { servings: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1 rounded-2xl bg-primary p-4 ring-1 ring-secondary", className)} data-testid="servings">
      <p className="text-sm text-tertiary">Получится</p>
      <p className="font-display text-display-xs text-primary" aria-live="polite">
        {servingsLabel(servings)}
      </p>
      <p className="mt-2 text-sm text-tertiary">
        Пример: количества умножены точно. Как красиво округлять (например, яйца — целыми) — отдельный этап.
      </p>
    </div>
  );
}
