"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Key, Selection } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Input } from "@/components/base/input/input";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";

import { type CompositionTag, PROTOTYPE, type SectionId, isSectionId } from "../_demo/demo-catalog";
import { type DemoQuery, INGREDIENT_CHIPS } from "../_demo/demo-search";
import { SearchRefine } from "./search-refine";
import { SearchResults } from "./search-results";
import { SEGMENT } from "./segment";

const CHIP = "min-h-11 rounded-full px-4 text-md";

const keysOf = <T extends string>(selection: Selection): T[] => (selection === "all" ? [] : ([...selection] as T[]));

// Прототип поиска за лупой (решение владельца 01.10): «По рецепту / По ингредиенту», выбор ингредиентов
// касанием по всей «таблетке», уточнение разделом и тегами состава. На сайте — отдельная страница
// /{locale}/search с состоянием в адресе (ADR-0017); здесь из адреса читается только раздел.
export function SearchPrototype() {
  const initialSection = useSearchParams().get("section");
  const [mode, setMode] = useState<DemoQuery["mode"]>("recipe");
  const [text, setText] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [section, setSection] = useState<SectionId | null>(isSectionId(initialSection) ? initialSection : null);
  const [tags, setTags] = useState<CompositionTag[]>([]);
  const query: DemoQuery = { mode, text, ingredients, section, tags };

  const changeMode = (keys: Set<Key>) => {
    const [next] = keys;
    if (next === "recipe" || next === "ingredient") setMode(next);
  };
  const reset = () => {
    setText("");
    setIngredients([]);
    setSection(null);
    setTags([]);
  };
  const chips = INGREDIENT_CHIPS.filter((name) => name.toLowerCase().includes(text.trim().toLowerCase()));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-16 lg:px-8">
      <div className="flex items-center gap-3">
        <AppButton color="tertiary" href={PROTOTYPE.home} iconLeading={ArrowLeft} aria-label="Назад" />
        <h1 className="font-display text-display-xs text-primary">Поиск</h1>
      </div>

      <section className="flex max-w-3xl flex-col gap-4">
        <ButtonGroup aria-label="Как искать" size="lg" selectedKeys={[mode]} onSelectionChange={changeMode} disallowEmptySelection className="w-full">
          <ButtonGroupItem id="recipe" className={SEGMENT}>
            По рецепту
          </ButtonGroupItem>
          <ButtonGroupItem id="ingredient" className={SEGMENT}>
            По ингредиенту
          </ButtonGroupItem>
        </ButtonGroup>

        <Input
          aria-label={mode === "recipe" ? "Название рецепта" : "Найти ингредиент"}
          size="lg"
          icon={Search}
          value={text}
          onChange={setText}
          placeholder={mode === "recipe" ? "Например, сырники" : "Например, творог"}
        />

        {mode === "ingredient" && (
          <TagGroup
            label="Ингредиенты"
            selectionMode="multiple"
            size="lg"
            selectedKeys={ingredients}
            onSelectionChange={(selection) => setIngredients(keysOf(selection))}
          >
            <TagList className="flex flex-wrap gap-2">
              {chips.map((name) => (
                <Tag key={name} id={name} className={CHIP}>
                  {name}
                </Tag>
              ))}
            </TagList>
          </TagGroup>
        )}

        <SearchRefine section={section} onSectionChange={setSection} tags={tags} onTagsChange={setTags} />
      </section>

      <SearchResults query={query} onReset={reset} />
    </main>
  );
}
