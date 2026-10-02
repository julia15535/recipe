"use client";

import { FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AppButton } from "@/components/app-button";

import { type Preview, previewRecipe, type SaveResult, saveNewRecipe, saveRecipeText } from "../actions";
import { type AiParsed, aiParseRecipe, saveParsedRecipe } from "../ai-actions";
import { AiChecks } from "./ai-checks";
import { ParseIssues } from "./parse-issues";
import { RecipePreview } from "./recipe-preview";
import { RecipeTextField } from "./recipe-text-field";
import { SaveButtons } from "./save-buttons";

type Props = { initialText?: string; recipe?: { id: string; revision: number }; aiEnabled: boolean };
type Stage = { kind: "edit" } | { kind: "ai"; result: Extract<AiParsed, { ok: true }> } | { kind: "plain"; preview: Preview };
const OFFLINE = "Нет связи с сайтом — проверьте интернет и нажмите ещё раз. Текст на месте.";

// Добавление и правка (планы recipe-upload, recipe-ai-parse): вставить рецепт как есть → «Разобрать» (ИИ) →
// «Проверьте» и предпросмотр → сохранить. Сбой ИИ — «Разобрать по старому формату» (разбор без ИИ).
export function RecipeEditor({ initialText = "", recipe, aiEnabled }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [stage, setStage] = useState<Stage>({ kind: "edit" });
  const [message, setMessage] = useState<string | null>(null);
  const [offerPlain, setOfferPlain] = useState(!aiEnabled);
  const [version, setVersion] = useState(0);
  const [pending, start] = useTransition();

  const run = (work: () => Promise<void>) =>
    start(async () => {
      setMessage(null);
      try {
        await work();
      } catch {
        setMessage(OFFLINE);
        setOfferPlain(true);
      }
    });
  const show = (next: Stage) => {
    setStage(next);
    setVersion((current) => current + 1);
    window.scrollTo({ top: 0 });
  };
  const parseAi = () =>
    run(async () => {
      const result = await aiParseRecipe(text);
      if (result.ok) return show({ kind: "ai", result });
      setMessage(result.message);
      setOfferPlain(true);
    });
  const parsePlain = () => run(async () => show({ kind: "plain", preview: await previewRecipe(text) }));
  const done = (result: SaveResult | { ok: true; id: string } | { ok: false; message: string }) => {
    if (result.ok) router.push(`/admin/recipes/${result.id}`);
    else setMessage(result.message ?? null);
  };
  const save = (publish: boolean) =>
    run(async () => {
      if (stage.kind === "ai") done(await saveParsedRecipe({ importId: stage.result.importId, publish, target: recipe ?? null }));
      else done(recipe ? await saveRecipeText(recipe.id, recipe.revision, text) : await saveNewRecipe(text, publish));
    });

  const alert = message && (
    <p role="alert" className="rounded-xl bg-accent-50 p-4 text-md text-primary">
      {message}
    </p>
  );

  if (stage.kind === "edit") {
    return (
      <div className="flex flex-col gap-4">
        {alert}
        <RecipeTextField value={text} onChange={setText} />
        <div className="flex flex-wrap gap-3">
          {aiEnabled && (
            <AppButton iconLeading={Sparkles} onPress={parseAi} isDisabled={pending || text.trim() === ""}>
              {pending ? "Разбираю рецепт…" : message ? "Разобрать ещё раз" : "Разобрать"}
            </AppButton>
          )}
          {offerPlain && (
            <AppButton color="secondary" iconLeading={FileText} onPress={parsePlain} isDisabled={pending || text.trim() === ""}>
              Разобрать по старому формату
            </AppButton>
          )}
        </div>
      </div>
    );
  }

  const ai = stage.kind === "ai" ? stage.result : null;
  const view = ai ? ai.view : stage.kind === "plain" ? stage.preview.view : null;
  const ready = ai ? ai.ready : stage.kind === "plain" && stage.preview.ok;
  return (
    <div className="flex flex-col gap-4">
      {ai ? <AiChecks checks={ai.checks} ready={ai.ready} /> : stage.kind === "plain" && <ParseIssues issues={stage.preview.issues} />}
      {alert}
      <SaveButtons editing={Boolean(recipe)} ready={ready} pending={pending} onBack={() => setStage({ kind: "edit" })} onSave={save} />
      {view && <RecipePreview view={view} version={version} />}
    </div>
  );
}
