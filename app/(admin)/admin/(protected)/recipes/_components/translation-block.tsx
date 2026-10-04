"use client";

import { ExternalLink, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppButton } from "@/components/app-button";
import type { TranslationState } from "@/lib/server/recipes/translation-queue";

import { translateRecipe } from "../translation-actions";

// Английская версия рецепта (ADR-0029): переводит ИИ сам после публикации; правка русского перевод не трогает —
// «устарела», пока владелец не нажмёт «Перевести заново» (решения владельца 03.10). Пока идёт перевод — страница
// обновляется сама, по одному обновлению за раз (следующее — после ответа).
type Props = { id: string; published: boolean; state: TranslationState };

// «Задание выполнено, а перевода не видно» — переходное (подстраховка: состояние читается одним снимком, плана
// translation-status-race): несколько обновлений, потом — просьба обновить страницу, а не бесконечный опрос.
const SETTLE_TRIES = 5;

export function TranslationBlock({ id, published, state }: Props) {
  const router = useRouter();
  const active = state.job?.status === "queued" || state.job?.status === "running";
  const settling = !active && state.job?.status === "done" && !state.slug;
  const [tries, setTries] = useState(0);
  const waiting = active || (settling && tries < SETTLE_TRIES);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      if (settling) setTries((count) => count + 1);
      router.refresh();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [waiting, settling, state, router]);

  const failed = state.job?.status === "failed";
  const status = active
    ? state.slug
      ? "переводится заново… на сайте пока прежний перевод"
      : "переводится…"
    : settling
      ? waiting
        ? "перевод готов, обновляем статус…"
        : "не удалось обновить статус — обновите страницу"
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
      <p
        aria-live="polite"
        className="text-md text-secondary"
        data-translation={active ? "active" : settling ? "settling" : state.slug ? (state.outdated ? "outdated" : "ready") : "none"}
      >
        {status}
        {state.slug && failed && !active && " · последняя попытка не удалась, на сайте прежний перевод"}
      </p>
      <div className="flex flex-wrap gap-3">
        {!waiting && (published || state.slug) && (
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
