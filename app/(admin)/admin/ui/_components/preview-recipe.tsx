"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { AppButton } from "@/components/app-button";
import { Tab, TabList, TabPanel, Tabs } from "@/components/application/tabs/tabs";
import { Badge } from "@/components/base/badges/badges";

import { QuickBadge } from "./quick-badge";

// Макет страницы рецепта: табы «Рецепт / Приготовление» и порции. Пересчёт здесь — только для вида:
// настоящие правила округления — отдельный этап (ADR-0004).
const BASE_SERVINGS = 4;
const INGREDIENTS: { name: string; amount: number; unit: string }[] = [
  { name: "Творог 5%", amount: 500, unit: "г" },
  { name: "Яйцо", amount: 1, unit: "шт." },
  { name: "Мука", amount: 60, unit: "г" },
  { name: "Сахар", amount: 30, unit: "г" },
];
const STEPS = [
  "Разомните творог вилкой до однородности.",
  "Добавьте яйцо и сахар, перемешайте.",
  "Всыпьте муку и сформируйте небольшие шайбы.",
  "Обжарьте на среднем огне по 3–4 минуты с каждой стороны.",
];

function demoAmount(amount: number, unit: string, factor: number) {
  const value = amount * factor;
  return unit === "шт." ? Math.max(1, Math.round(value)) : Math.round(value / 5) * 5;
}

export function PreviewRecipe() {
  const [servings, setServings] = useState(BASE_SERVINGS);
  const factor = servings / BASE_SERVINGS;

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge color="brand" size="md">
            Завтраки
          </Badge>
          <QuickBadge size="md" />
        </div>
        <h2 className="font-display text-display-xs text-primary">Сырники со сметаной</h2>
        <p className="text-md text-tertiary">Нежные внутри, с хрустящей корочкой — к чаю или на завтрак.</p>
      </div>

      <Tabs defaultSelectedKey="recipe">
        <TabList aria-label="Разделы рецепта" type="button-brand" size="md" fullWidth className="rounded-full bg-secondary p-1">
          <Tab id="recipe" className="min-h-11 rounded-full">
            Рецепт
          </Tab>
          <Tab id="steps" className="min-h-11 rounded-full">
            Приготовление
          </Tab>
        </TabList>

        <TabPanel id="recipe" className="pt-4">
          <div className="flex items-center justify-between rounded-2xl bg-accent-50 p-2 pl-4">
            <span className="text-md font-medium text-secondary">Порции</span>
            <div className="flex items-center gap-2">
              <AppButton
                color="secondary"
                iconLeading={Minus}
                aria-label="Меньше порций"
                isDisabled={servings <= 1}
                onPress={() => setServings((value) => value - 1)}
              />
              <span className="w-8 text-center text-lg font-semibold text-primary" aria-live="polite">
                {servings}
              </span>
              <AppButton color="secondary" iconLeading={Plus} aria-label="Больше порций" onPress={() => setServings((value) => value + 1)} />
            </div>
          </div>
          <ul className="mt-3 divide-y divide-secondary">
            {INGREDIENTS.map(({ name, amount, unit }) => (
              <li key={name} className="flex justify-between py-3 text-md">
                <span className="text-secondary">{name}</span>
                <span className="font-semibold text-primary">
                  {demoAmount(amount, unit, factor)} {unit}
                </span>
              </li>
            ))}
          </ul>
        </TabPanel>

        <TabPanel id="steps" className="pt-4">
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
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
    </section>
  );
}
