"use client";

import { ExternalLink, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppButton } from "@/components/app-button";
import type { TranslationState } from "@/lib/server/recipes/translation-queue";

import { translateRecipe } from "../translation-actions";

// Английская версия рецепта (ADR-0029): переводит ИИ сам после публикации; правка русского перевод не трогает —
// «устарела», пока владелец не нажмёт «Перевести заново» (решения владельца 03.10). Пока идёт перевод — страница
// обновляется сама.
type Props = { id: string; published: boolean; state: TranslationState };

export function TranslationBlock({ id, published, state }: Props) {
  const router = useRouter();
  const active = state.job?.status === "queued" || state.job?.status === "running";
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  const failed = state.job?.status === "failed";
  const status = active
    ? state.slug
      ? "переводится заново… на сайте пока прежний перевод"
      : "переводится…"
    : state.slug
      ? state.outdated
        ? "устарела — вы меняли рецепт после перевода; на сайте прежний перевод"
        : "готова"
      : failed
        ? "не получилась — попробуйте ещё раз"
        : published
          ? "ещё нет"
          : "появится после публикации";

  return (
    <section aria-labelledby="translation-title" className="flex flex-col gap-3 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
      <h2 id="translation-title" className="font-display text-xl text-primary">
        Английская версия
      </h2>
      <p aria-live="polite" className="text-md text-secondary" data-translation={active ? "active" : state.slug ? (state.outdated ? "outdated" : "ready") : "none"}>
        {status}
        {state.slug && failed && !active && " · последняя попытка не удалась, на сайте прежний перевод"}
      </p>
      <div className="flex flex-wrap gap-3">
        {!active && (published || state.slug) && (
          <form action={translateRecipe}>
            <input type="hidden" name="id" value={id} />
            <AppButton type="submit" color={state.slug && !state.outdated ? "tertiary" : "secondary"} iconLeading={Languages}>
              {state.slug ? "Перевести заново" : "Перевести"}
            </AppButton>
          </form>
        )}
        {state.slug && published && (
          <AppButton color="tertiary" iconLeading={ExternalLink} href={`/en/recipe/${state.slug}`}>
            Открыть по-английски
          </AppButton>
        )}
      </div>
    </section>
  );
}
