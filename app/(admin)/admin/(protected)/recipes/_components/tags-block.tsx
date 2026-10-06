"use client";

import { Check, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { AppButton } from "@/components/app-button";
import { tagClass } from "@/components/recipe/composition-tags";
import type { TagCode } from "@/lib/domain/catalog";
import { cx } from "@/utils/cx";

import { saveRecipeTags, suggestRecipeTags } from "../tag-actions";

// Теги состава рецепта (план recipe-tags-button, ADR-0036): все теги каталога — чипами (касание по всему чипу),
// «Подобрать с ИИ» показывает предложение, «Отметить предложенное» заменяет выбор целиком, «Сохранить теги» пишет.
// Без key={revision} (anti-patterns №54): ревизия — свежая из пришедшей (публикация её двигает) и полученной при сохранении.
type Props = { recipeId: string; revision: number; tags: { code: TagCode; label: string }[]; current: TagCode[] };
type Note = { text: string; error: boolean } | null;

const sameSet = (a: readonly string[], b: readonly string[]) => [...a].sort().join() === [...b].sort().join();

export function TagsBlock({ recipeId, revision, tags, current }: Props) {
  const [saved, setSaved] = useState<{ revision: number; tags: TagCode[] } | null>(null);
  const base = saved && saved.revision >= revision ? saved : { revision, tags: current };
  const [selected, setSelected] = useState<TagCode[]>(current);
  const [suggestion, setSuggestion] = useState<TagCode[] | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [doing, setDoing] = useState<"suggest" | "save" | null>(null);
  const [pending, start] = useTransition();
  const labelOf = (code: TagCode) => tags.find((tag) => tag.code === code)?.label ?? code;
  const toggle = (code: TagCode) => setSelected((list) => (list.includes(code) ? list.filter((item) => item !== code) : [...list, code]));

  const run = (kind: "suggest" | "save", work: () => Promise<void>) =>
    start(async () => {
      setDoing(kind);
      setNote(null);
      try {
        await work();
      } catch {
        setNote({ text: "Нет связи с сайтом — попробуйте ещё раз.", error: true });
      } finally {
        setDoing(null);
      }
    });
  const suggest = () =>
    run("suggest", async () => {
      const result = await suggestRecipeTags({ id: recipeId, revision: base.revision });
      if (result.ok) setSuggestion(result.tags);
      else setNote({ text: result.message, error: true });
    });
  const save = () =>
    run("save", async () => {
      const result = await saveRecipeTags({ id: recipeId, revision: base.revision, tags: selected });
      if (!result.ok) return setNote({ text: result.message, error: true });
      setSaved({ revision: result.revision, tags: result.tags });
      setSelected(result.tags);
      setNote({ text: "Теги сохранены.", error: false });
    });

  return (
    <section aria-labelledby="tags-title" className="flex flex-col gap-3 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
      <h2 id="tags-title" className="font-display text-xl text-primary">
        Теги состава
      </h2>
      <p className="text-md text-tertiary">Отметьте, что заметно в составе. Первый тег виден на карточке рецепта.</p>
      <ul className="flex flex-wrap gap-2">
        {tags.map(({ code, label }) => {
          const on = selected.includes(code);
          return (
            <li key={code}>
              <button
                type="button"
                aria-pressed={on}
                disabled={pending}
                onClick={() => toggle(code)}
                className={cx(
                  "flex min-h-11 items-center gap-1.5 rounded-full px-4 text-md ring-1 ring-inset disabled:opacity-70",
                  on ? cx(tagClass(code), "font-semibold") : "bg-primary text-secondary ring-secondary",
                )}
              >
                {on && <Check className="size-4" aria-hidden />}
                {label}
              </button>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        {suggestion && (
          <p className="text-md text-secondary">
            {suggestion.length ? `ИИ предлагает: ${suggestion.map(labelOf).join(", ")}.` : "ИИ не нашёл подходящих тегов."}
          </p>
        )}
        {note && !note.error && <p className="text-md text-secondary">{note.text}</p>}
      </div>
      <p role="alert" className="text-md text-error-primary empty:hidden">
        {note?.error ? note.text : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <AppButton color="secondary" iconLeading={Sparkles} onPress={suggest} isDisabled={pending}>
          {doing === "suggest" ? "Подбираю…" : "Подобрать с ИИ"}
        </AppButton>
        {suggestion && (
          <AppButton color="secondary" onPress={() => setSelected(suggestion)} isDisabled={pending || sameSet(suggestion, selected)}>
            Отметить предложенное
          </AppButton>
        )}
        <AppButton onPress={save} isDisabled={pending || sameSet(selected, base.tags)}>
          {doing === "save" ? "Сохраняю…" : "Сохранить теги"}
        </AppButton>
      </div>
    </section>
  );
}
