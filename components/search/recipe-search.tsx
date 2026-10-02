"use client";

import { ArrowLeft, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Key } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Input } from "@/components/base/input/input";
import type { CardData } from "@/components/recipe/recipe-card";
import { matches, paramsFromQuery, queryFromParams, rankedChips, type SearchQuery } from "@/lib/domain/search";

import { IngredientChips } from "./ingredient-chips";
import { SearchRefine } from "./search-refine";
import { SearchResults } from "./search-results";
import { SEGMENT } from "./segment";

export type SearchEntry = CardData & { ingredients: string[]; sections: string[]; tagCodes: string[] };
type Props = {
  items: SearchEntry[];
  sections: readonly { code: string; label: string; recipes: number }[];
  tags: readonly { code: string; label: string }[];
  homeHref: string;
};

// Поиск (решение владельца 01.10): «По рецепту / По ингредиенту», «таблетки» ингредиентов, уточнение разделом и
// тегами; отдельная страница, на компьютере — карточкой по центру. Ищет мгновенно в браузере по индексу
// опубликованных рецептов (`lib/domain/search.ts`); состояние — в адресе (`by`, `q`, `i`, `section`, `tag`).
export function RecipeSearch({ items, sections, tags, homeHref }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = useMemo(() => sections.filter((section) => section.recipes > 0), [sections]);
  const [query, setQuery] = useState<SearchQuery>(() =>
    queryFromParams(params, active.map((s) => s.code), tags.map((t) => t.code)),
  );
  // Раздел из адреса мог опустеть — фильтр не применяем, пояснение держим, пока не выбран другой (ADR-0020).
  const [staleSection] = useState(() => sections.find((s) => s.code === params.get("section") && s.recipes === 0));
  // Адрес сменили снаружи (лупа в шапке на странице поиска, ссылка с параметрами) — поиск следует за адресом;
  // свои записи (`written`) за внешние не принимаем, иначе потерялись бы буквы, набранные за 300 мс.
  const current = params.toString();
  const [seen, setSeen] = useState(current);
  const [written, setWritten] = useState(current);
  if (current !== seen) {
    setSeen(current);
    if (current !== written) {
      setWritten(current);
      setQuery(queryFromParams(params, active.map((s) => s.code), tags.map((t) => t.code)));
    }
  }

  // Адрес следует за поиском (без новых записей в истории — «Назад» ведёт туда, откуда пришли).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = paramsFromQuery(query);
      if (next.slice(1) === written) return;
      setWritten(next.slice(1));
      router.replace(`${pathname}${next}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, written, pathname, router]);

  const update = (patch: Partial<SearchQuery>) => setQuery((current) => ({ ...current, ...patch }));
  const changeMode = (keys: Set<Key>) => {
    const [next] = keys;
    if (next === "recipe" || next === "ingredient") update({ mode: next });
  };
  const reset = () => setQuery({ mode: query.mode, text: "", ingredients: [], section: null, tags: [] });
  const ranked = useMemo(() => rankedChips(items.map((item) => item.ingredients)), [items]);
  const found = items.filter((item) => matches({ title: item.title, ingredients: item.ingredients, sections: item.sections, tags: item.tagCodes }, query));
  const back = () => {
    const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation;
    if (navigation?.canGoBack) router.back();
    else router.push(homeHref);
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-16 lg:gap-8 lg:px-8 lg:pt-10">
      <section
        aria-label="Поиск рецептов"
        data-testid="search-card"
        className="flex w-full max-w-3xl flex-col gap-4 lg:mx-auto lg:rounded-3xl lg:bg-primary lg:p-8 lg:shadow-sm lg:ring-1 lg:ring-secondary"
      >
        <div className="flex items-center gap-3">
          <AppButton color="tertiary" onPress={back} iconLeading={ArrowLeft} aria-label="Назад" />
          <h1 className="font-display text-display-xs text-primary">Поиск</h1>
        </div>

        <ButtonGroup aria-label="Как искать" size="lg" selectedKeys={[query.mode]} onSelectionChange={changeMode} disallowEmptySelection className="w-full">
          <ButtonGroupItem id="recipe" className={SEGMENT}>
            По рецепту
          </ButtonGroupItem>
          <ButtonGroupItem id="ingredient" className={SEGMENT}>
            По ингредиенту
          </ButtonGroupItem>
        </ButtonGroup>

        <Input
          aria-label={query.mode === "recipe" ? "Название рецепта" : "Найти ингредиент"}
          size="lg"
          icon={Search}
          value={query.text}
          onChange={(text) => update({ text })}
          placeholder={query.mode === "recipe" ? "Например, сырники" : "Например, творог"}
        />

        {query.mode === "ingredient" && (
          <IngredientChips ranked={ranked} text={query.text} selected={query.ingredients} onChange={(ingredients) => update({ ingredients })} />
        )}

        {staleSection && query.section === null && (
          <p className="text-sm text-tertiary">Раздел «{staleSection.label}» пока пуст — выберите другой или начните поиск.</p>
        )}
        <SearchRefine
          sections={active}
          section={query.section}
          onSectionChange={(section) => update({ section })}
          tags={tags}
          selectedTags={query.tags}
          onTagsChange={(selected) => update({ tags: selected })}
        />
      </section>

      <SearchResults query={query} total={items.length} found={found} onReset={reset} />
    </main>
  );
}
