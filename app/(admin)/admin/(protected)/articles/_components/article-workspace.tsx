"use client";

import { ImagePlus } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { ArticleBody } from "@/components/article/article-body";
import type { ArticleView } from "@/components/article/view";
import { AppButton } from "@/components/app-button";
import { CropDialog, type CropImage } from "@/components/media/crop-dialog";
import { ShrinkError, shrinkImage } from "@/components/media/shrink-image";
import { RecipePhoto } from "@/components/recipe/recipe-photo";
import { ARTICLE_LIMITS, markerLine } from "@/lib/domain/article-text/lines";
import { type CropFractions, type CropRect, type PhotoRef, photoUrl, type Size, toFractions } from "@/lib/domain/photo";

import { addPhotoHere, captionArticlePhoto, recropArticle, removeArticlePhotoAction } from "../photo-actions";
import { PhotoTools } from "./photo-tools";

// Статья в кабинете как на сайте (ADR-0034) + фото: «Добавить фото сюда» между блоками (уменьшение в браузере →
// кадр 4:3 → сервер ставит метку в текст), у фото — кадр, подпись, «Убрать»; фото «без места» (метку убрали из
// текста в «Изменить») — отдельным списком: можно убрать или вернуть меткой в текст.
export type WorkspacePhoto = { key: string; id: string; size: Size; crop: CropRect; caption: string | null; ref: PhotoRef; placed: boolean };
type Props = { articleId: string; revision: number; view: ArticleView; photos: WorkspacePhoto[] };
type Target = { mode: "add"; after: string } | { mode: "recrop"; key: string; expected: string };
type Editing = { image: CropImage; initial?: CropFractions; upload: Blob | null; target: Target };
type Result = { ok: true } | { ok: false; message: string };

const FAILED = "Не получилось сохранить — проверьте связь и попробуйте ещё раз.";
const SHRINK = { open: "Не получилось открыть фото — сохраните его как JPEG и попробуйте ещё раз.", small: "Фото слишком маленькое — выберите снимок побольше.", large: "Фото слишком большое — выберите другое." } as const;

export function ArticleWorkspace({ articleId, revision, view, photos }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const slot = useRef("top");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<Result>, done: string) => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await action();
      if (result.ok) setStatus(done);
      return result;
    } catch {
      return { ok: false as const, message: FAILED };
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (editing?.upload) URL.revokeObjectURL(editing.image.url);
    setEditing(null);
    setError(null);
  };
  const choose = (after: string) => {
    slot.current = after;
    input.current?.click();
  };
  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setStatus("Готовим фото…");
    try {
      const shrunk = await shrinkImage(file);
      setEditing({ image: { url: shrunk.url, width: shrunk.width, height: shrunk.height }, upload: shrunk.blob, target: { mode: "add", after: slot.current } });
      setStatus(null);
    } catch (failure) {
      setStatus(null);
      setProblem(failure instanceof ShrinkError ? SHRINK[failure.reason] : SHRINK.open);
    }
  };
  const save = async (crop: CropFractions) => {
    if (!editing) return;
    const { target, upload } = editing;
    const result = await run(() => {
      if (target.mode === "recrop" || !upload) return recropArticle(articleId, target.mode === "recrop" ? target.key : "", target.mode === "recrop" ? target.expected : "", crop);
      const form = new FormData();
      form.set("articleId", articleId);
      form.set("revision", String(revision));
      form.set("after", target.after);
      form.set("crop", JSON.stringify(crop));
      form.set("photo", upload, "photo.jpg");
      return addPhotoHere(form);
    }, "Фото сохранено.");
    if (result.ok) close();
    else setError(result.message);
  };
  const report = (result: Result) => !result.ok && setProblem(result.message);
  const tools = (photo: WorkspacePhoto) => (
    <PhotoTools
      photoKey={photo.key}
      caption={photo.caption}
      busy={busy}
      onRecrop={() => setEditing({ image: { url: photoUrl(photo.id, "source.jpg", "article"), ...photo.size }, initial: toFractions(photo.crop, photo.size), upload: null, target: { mode: "recrop", key: photo.key, expected: photo.id } })}
      onCaption={(caption) => void run(() => captionArticlePhoto(articleId, photo.key, caption), "Подпись сохранена.").then(report)}
      onRemove={() => void run(() => removeArticlePhotoAction(articleId, revision, photo.key), "Фото убрано.").then(report)}
    />
  );

  const full = photos.length >= ARTICLE_LIMITS.photos;
  const addHere = (after: string): ReactNode =>
    full ? null : (
      <AppButton color="tertiary" size="lg" iconLeading={ImagePlus} onPress={() => choose(after)} isDisabled={busy} className="self-start" data-add-photo={after}>
        Добавить фото сюда
      </AppButton>
    );
  const after: Record<string, ReactNode> = { top: addHere("top") };
  for (const block of view.blocks) after[block.id] = addHere(block.id);
  const placed = Object.fromEntries(photos.filter((photo) => photo.placed).map((photo) => [photo.key, tools(photo)]));
  const loose = photos.filter((photo) => !photo.placed);

  return (
    <div className="flex flex-col gap-6">
      <input ref={input} type="file" accept="image/*" aria-label="Файл фото" className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />
      <div className="flex flex-col gap-2 px-4">
        <p aria-live="polite" className="text-sm text-secondary empty:hidden">
          {status}
        </p>
        {problem && (
          <p role="alert" className="text-md text-error-primary">
            {problem}
          </p>
        )}
        {full && <p className="text-md text-tertiary">В статье 10 фото — больше добавить нельзя.</p>}
      </div>
      <ArticleBody view={view} recipesLabel="Рецепты из статьи" after={after} tools={placed} />
      {loose.length > 0 && (
        <section aria-labelledby="loose-photos" className="mx-4 flex flex-col gap-4 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
          <h2 id="loose-photos" className="font-display text-xl text-primary">
            Фото без места
          </h2>
          <p className="text-md text-tertiary">Метки этих фото нет в тексте. Чтобы вернуть фото в статью, вставьте его строку-метку в текст через «Изменить».</p>
          {loose.map((photo) => (
            <div key={photo.key} className="flex flex-col gap-2">
              <RecipePhoto photo={photo.ref} alt={photo.caption ?? view.title} sizes="320px" className="max-w-xs rounded-xl" />
              <p className="text-md text-secondary">
                Метка: <span className="font-semibold text-primary">{markerLine(photo.key)}</span>
              </p>
              {tools(photo)}
            </div>
          ))}
        </section>
      )}
      <CropDialog image={editing?.image ?? null} initial={editing?.initial} busy={busy} error={error} onCancel={close} onDone={(crop) => void save(crop)} />
    </div>
  );
}
