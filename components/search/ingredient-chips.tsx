"use client";

import { useState } from "react";
import type { Selection } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";
import { normalize } from "@/lib/domain/search";

const CHIP = "min-h-11 rounded-full px-4 text-md";
const FIRST = 12;

type Props = { ranked: string[]; text: string; selected: string[]; onChange: (selected: string[]) => void };

// «Таблетки» ингредиентов (выбор касанием по всей таблетке). Пока поле пустое — самые частые и «Все ингредиенты»,
// чтобы с ростом книги список не уводил результаты за экран; набранный текст фильтрует весь список. Выбранный
// ингредиент не прячем — иначе он фильтрует результаты, а снять его нельзя.
export function IngredientChips({ ranked, text, selected, onChange }: Props) {
  const [all, setAll] = useState(false);
  const typed = normalize(text);
  const shown = typed
    ? ranked.filter((name) => selected.includes(name) || normalize(name).includes(typed))
    : all
      ? ranked
      : [...ranked.slice(0, FIRST), ...selected.filter((name) => !ranked.slice(0, FIRST).includes(name))];
  const pick = (selection: Selection) => onChange(selection === "all" ? [] : [...selection].map(String));

  return (
    <div className="flex flex-col gap-2">
      <TagGroup label="Ингредиенты" selectionMode="multiple" size="lg" selectedKeys={selected} onSelectionChange={pick}>
        <TagList className="flex flex-wrap gap-2">
          {shown.map((name) => (
            <Tag key={name} id={name} className={CHIP}>
              {name}
            </Tag>
          ))}
        </TagList>
      </TagGroup>
      {!typed && !all && ranked.length > FIRST && (
        <AppButton color="link-color" onPress={() => setAll(true)} className="min-h-11 self-start">
          {`Все ингредиенты · ${ranked.length}`}
        </AppButton>
      )}
    </div>
  );
}
