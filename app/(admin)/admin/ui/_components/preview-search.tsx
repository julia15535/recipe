"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import type { Key } from "react-aria-components";

import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Input } from "@/components/base/input/input";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";

import { SEGMENT } from "./palette-switch";

const INGREDIENTS = ["Творог", "Яйцо", "Мука", "Сметана", "Курица", "Грибы", "Сыр", "Томаты"];

// Макет поиска с главной: переключатель режима, поле и «таблетки» ингредиентов (выбор касанием
// по всей таблетке — крупная цель для пальца, ADR-0002).
export function PreviewSearch() {
  const [mode, setMode] = useState<Key>("ingredient");

  const changeMode = (keys: Set<Key>) => {
    const [next] = keys;
    if (next !== undefined) setMode(next);
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
      <ButtonGroup
        aria-label="Как искать"
        size="lg"
        selectedKeys={[mode]}
        onSelectionChange={changeMode}
        disallowEmptySelection
        className="w-full"
      >
        <ButtonGroupItem id="recipe" className={SEGMENT}>
          По рецепту
        </ButtonGroupItem>
        <ButtonGroupItem id="ingredient" className={SEGMENT}>
          По ингредиенту
        </ButtonGroupItem>
      </ButtonGroup>

      <Input
        aria-label="Поиск"
        size="lg"
        icon={Search}
        placeholder={mode === "recipe" ? "Например, сырники" : "Например, творог"}
      />

      {mode === "ingredient" && (
        <TagGroup label="Ингредиенты" selectionMode="multiple" size="lg" defaultSelectedKeys={["Творог", "Яйцо"]}>
          <TagList className="flex flex-wrap gap-2">
            {INGREDIENTS.map((name) => (
              <Tag key={name} id={name} className="min-h-11 rounded-full px-4 text-md">
                {name}
              </Tag>
            ))}
          </TagList>
        </TagGroup>
      )}
    </section>
  );
}
