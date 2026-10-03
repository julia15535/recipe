"use client";

import { Crop, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { AppButton } from "@/components/app-button";
import { CropDialog, type CropImage } from "@/components/media/crop-dialog";
import { ShrinkError, shrinkImage } from "@/components/media/shrink-image";
import { RecipePhoto } from "@/components/recipe/recipe-photo";
import { type CropFractions, type CropRect, type PhotoRef, photoUrl, type Size, toFractions } from "@/lib/domain/photo";

import { recropPhoto, removePhoto, uploadPhoto } from "../photo-actions";

// Фото блюда в кабинете (план recipe-photos): добавить → уменьшить в браузере → кадр 4:3 → сохранить; «Изменить
// кадр» — по сохранённому исходнику, без повторного выбора; «Заменить», «Убрать» (с подтверждением).
type Props = { recipeId: string; title: string; photo: (PhotoRef & { size: Size; crop: CropRect }) | null };
type Editing = { image: CropImage; initial?: CropFractions; upload: Blob | null };

const FAILED = "Не получилось сохранить — проверьте связь и попробуйте ещё раз.";
const SHRINK_MESSAGES = {
  open: "Не получилось открыть фото — сохраните его как JPEG и попробуйте ещё раз.",
  small: "Фото слишком маленькое — выберите снимок побольше.",
  large: "Фото слишком большое — выберите другое.",
} as const;

export function PhotoBlock({ recipeId, title, photo }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    if (editing?.upload) URL.revokeObjectURL(editing.image.url);
    setEditing(null);
    setError(null);
  };

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setProblem(null);
    setStatus("Готовим фото…");
    try {
      const shrunk = await shrinkImage(file);
      setEditing({ image: { url: shrunk.url, width: shrunk.width, height: shrunk.height }, upload: shrunk.blob });
      setStatus(null);
    } catch (failure) {
      setStatus(null);
      setProblem(failure instanceof ShrinkError ? SHRINK_MESSAGES[failure.reason] : SHRINK_MESSAGES.open);
    }
  };

  // Сбой сети, конец сессии, 413 — исключение из Server Action: кнопки не должны остаться в «Сохраняем…».
  const run = async (action: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    setBusy(true);
    try {
      return await action();
    } catch {
      return { ok: false as const, message: FAILED };
    } finally {
      setBusy(false);
    }
  };

  const save = async (crop: CropFractions) => {
    const upload = editing?.upload;
    if (!editing || (!upload && !photo)) return;
    setError(null);
    const result = await run(() => {
      if (!upload) return recropPhoto(recipeId, photo?.id ?? "", crop);
      const form = new FormData();
      form.set("recipeId", recipeId);
      form.set("expected", photo?.id ?? "");
      form.set("crop", JSON.stringify(crop));
      form.set("photo", upload, "photo.jpg");
      return uploadPhoto(form);
    });
    if (!result.ok) return setError(result.message);
    close();
    setStatus("Фото сохранено.");
  };

  const recrop = () =>
    photo &&
    setEditing({ image: { url: photoUrl(photo.id, "source.jpg"), ...photo.size }, initial: toFractions(photo.crop, photo.size), upload: null });

  const remove = async () => {
    if (!photo) return;
    const result = await run(() => removePhoto(recipeId, photo.id));
    setConfirming(false);
    if (result.ok) setStatus("Фото убрано.");
    else setProblem(result.message);
  };

  return (
    <section aria-labelledby="photo-title" className="flex flex-col gap-3 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
      <h2 id="photo-title" className="font-display text-xl text-primary">
        Фото блюда
      </h2>
      {photo ? (
        <RecipePhoto photo={photo} alt={title} sizes="(min-width: 640px) 320px, 100vw" className="max-w-xs rounded-xl" />
      ) : (
        <p className="text-md text-tertiary">Фото пока нет — на сайте вместо него спокойная заглушка.</p>
      )}
      <input ref={input} type="file" accept="image/*" aria-label="Файл фото" className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />
      <div className="flex flex-wrap gap-3">
        <AppButton color={photo ? "secondary" : "primary"} iconLeading={photo ? RefreshCw : ImagePlus} onPress={() => input.current?.click()} isDisabled={busy}>
          {photo ? "Заменить фото" : "Добавить фото"}
        </AppButton>
        {photo && (
          <>
            <AppButton color="secondary" iconLeading={Crop} onPress={recrop} isDisabled={busy}>
              Изменить кадр
            </AppButton>
            <AppButton color="tertiary" iconLeading={Trash2} onPress={() => setConfirming(true)} isDisabled={busy}>
              Убрать фото
            </AppButton>
          </>
        )}
      </div>
      {confirming && (
        <div role="alertdialog" aria-labelledby="photo-remove" className="flex flex-col gap-3 rounded-xl bg-accent-50 p-4">
          <p id="photo-remove" className="text-md text-primary">
            Убрать фото? На сайте снова будет заглушка.
          </p>
          <div className="flex flex-wrap gap-3">
            <AppButton color="primary-destructive" iconLeading={Trash2} onPress={() => void remove()} isLoading={busy}>
              Да, убрать
            </AppButton>
            <AppButton color="secondary" onPress={() => setConfirming(false)} autoFocus>
              Отмена
            </AppButton>
          </div>
        </div>
      )}
      <p aria-live="polite" className="text-sm text-secondary empty:hidden">
        {status}
      </p>
      {problem && (
        <p role="alert" className="text-md text-error-primary">
          {problem}
        </p>
      )}
      <CropDialog image={editing?.image ?? null} initial={editing?.initial} busy={busy} error={error} onCancel={close} onDone={(crop) => void save(crop)} />
    </section>
  );
}
