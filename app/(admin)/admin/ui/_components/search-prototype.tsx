"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Key, Selection } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Input } from "@/components/base/input/input";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";

import { type CompositionTagId, PROTOTYPE, SECTIONS, type SectionId, parseSectionId, sectionLabel } from "../_demo/demo-catalog";
import { useDemoMode } from "../_demo/demo-mode";
import { type DemoQuery, ingredientChips } from "../_demo/demo-search";
import { activeSections, demoRecipes } from "../_demo/demo-selection";
import { SearchRefine } from "./search-refine";
import { SearchResults } from "./search-results";
import { SEGMENT } from "./segment";

const CHIP = "min-h-11 rounded-full px-4 text-md";

const keysOf = <T extends string>(selection: Selection): T[] => (selection === "all" ? [] : ([...selection] as T[]));

// Прототип поиска за лупой (решение владельца 01.10): «По рецепту / По ингредиенту», выбор ингредиентов
// касанием по всей «таблетке», уточнение разделом и тегами состава. Отдельная страница (ADR-0017;
// владелец 01.10 оставила её, не окно), на компьютере — карточкой по центру. Из адреса читается раздел.
export function SearchPrototype() {
  const router = useRouter();
  const initialSection = parseSectionId(useSearchParams().get("section"));
  const [mode, setMode] = useState<DemoQuery["mode"]>("recipe");
  const [text, setText] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [section, setSection] = useState<SectionId | null>(initialSection);
  const [tags, setTags] = useState<CompositionTagId[]>([]);
  const recipes = demoRecipes(useDemoMode());
  const active = activeSections(recipes);
  // Раздел из адреса мог опустеть — тогда фильтр не применяем и говорим об этом (ADR-0020).
  const sectionActive = section !== null && active.has(section);
  const query: DemoQuery = { mode, text, ingredients, section: sectionActive ? section : null, tags };

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
  // Выбранный ингредиент не прячем фильтром поля — иначе он фильтрует результаты, а снять его нельзя.
  const chips = ingredientChips(recipes).filter(
    (name) => ingredients.includes(name) || name.toLowerCase().includes(text.trim().toLowerCase()),
  );
  // «Назад» — туда, откуда пришли (рецепт, главная). Navigation API видит только записи нашего сайта:
  // открыли поиск по ссылке извне или браузер его не знает — ведём на главную.
  const back = () => {
    const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation;
    if (navigation?.canGoBack) router.back();
    else router.push(PROTOTYPE.home);
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-16 lg:gap-8 lg:px-8 lg:pt-10">
      <section
        aria-label="Поиск рецептов"
        data-testid="search-card"
        className="flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-3xl lg:rounded-3xl lg:bg-primary lg:p-8 lg:shadow-sm lg:ring-1 lg:ring-secondary"
      >
        <div className="flex items-center gap-3">
          <AppButton color="tertiary" onPress={back} iconLeading={ArrowLeft} aria-label="Назад" />
          <h1 className="font-display text-display-xs text-primary">Поиск</h1>
        </div>

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

        {section !== null && !sectionActive && (
          <p className="text-sm text-tertiary">Раздел «{sectionLabel(section)}» пока пуст — показываем все рецепты.</p>
        )}
        <SearchRefine
          sections={SECTIONS.filter(({ id }) => active.has(id))}
          section={sectionActive ? section : null}
          onSectionChange={setSection}
          tags={tags}
          onTagsChange={setTags}
        />
      </section>

      <SearchResults query={query} recipes={recipes} onReset={reset} />
    </main>
  );
}
