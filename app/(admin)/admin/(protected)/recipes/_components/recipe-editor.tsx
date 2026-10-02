"use client";

import { ArrowLeft, Check, Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AppButton } from "@/components/app-button";
import { RecipeBody } from "@/components/recipe/recipe-body";
import { RecipeIntro } from "@/components/recipe/recipe-intro";

import { type Preview, previewRecipe, type SaveResult, saveNewRecipe, saveRecipeText } from "../actions";
import { ParseIssues } from "./parse-issues";
import { RecipeTextField } from "./recipe-text-field";

type Props = { initialText?: string; recipe?: { id: string; revision: number } };
const OFFLINE = "Нет связи с сайтом — проверьте интернет и нажмите ещё раз. Текст на месте.";

function Message({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-accent-50 p-4 text-md text-primary">
      {text}
    </p>
  );
}

// Добавление и правка рецепта (план recipe-upload): вставить текст → «Проверить» → предпросмотр как на
// сайте + «Что поправить» → сохранить. Правка = новая версия текста целиком (решение владельца 02.10).
export function RecipeEditor({ initialText = "", recipe }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [version, setVersion] = useState(0);

  const check = () =>
    start(async () => {
      setMessage(null);
      try {
        setPreview(await previewRecipe(text));
        setVersion((current) => current + 1);
        window.scrollTo({ top: 0 });
      } catch {
        setMessage(OFFLINE);
      }
    });
  const save = (publish: boolean) =>
    start(async () => {
      let result: SaveResult;
      try {
        result = recipe ? await saveRecipeText(recipe.id, recipe.revision, text) : await saveNewRecipe(text, publish);
      } catch {
        result = { ok: false, issues: [], message: OFFLINE };
      }
      if (result.ok) {
        router.push(`/admin/recipes/${result.id}`);
        return;
      }
      setMessage(result.message);
      if (result.issues.length) setPreview((current) => (current ? { ...current, ok: false, issues: result.issues } : current));
    });

  if (!preview) {
    return (
      <div className="flex flex-col gap-4">
        <Message text={message} />
        <RecipeTextField value={text} onChange={setText} />
        <AppButton iconLeading={Eye} onPress={check} isDisabled={pending || text.trim() === ""} className="self-start">
          Проверить
        </AppButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ParseIssues issues={preview.issues} />
      <Message text={message} />
      <div className="flex flex-wrap gap-3">
        <AppButton color="secondary" iconLeading={ArrowLeft} onPress={() => setPreview(null)} isDisabled={pending}>
          Исправить текст
        </AppButton>
        {recipe ? (
          <AppButton iconLeading={Check} onPress={() => save(false)} isDisabled={pending || !preview.ok}>
            Сохранить
          </AppButton>
        ) : (
          <>
            <AppButton color="secondary" iconLeading={Check} onPress={() => save(false)} isDisabled={pending || !preview.ok}>
              Сохранить черновик
            </AppButton>
            <AppButton iconLeading={Send} onPress={() => save(true)} isDisabled={pending || !preview.ok}>
              Опубликовать
            </AppButton>
          </>
        )}
      </div>
      {preview.view && (
        <section aria-label="Так рецепт будет выглядеть на сайте" className="-mx-4 rounded-2xl ring-1 ring-secondary sm:mx-0">
          <p className="px-4 pt-4 text-sm text-tertiary">Так рецепт будет выглядеть на сайте</p>
          <RecipeBody key={version} recipe={preview.view}>
            <RecipeIntro recipe={preview.view} />
          </RecipeBody>
        </section>
      )}
    </div>
  );
}
