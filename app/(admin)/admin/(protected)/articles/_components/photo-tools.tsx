"use client";

import { Crop, MessageSquareText, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppButton } from "@/components/app-button";

// Кнопки у фото статьи в кабинете: «Изменить кадр», «Подпись» (поле и «Сохранить»), «Убрать фото» (с вопросом).
type Props = {
  photoKey: string;
  caption: string | null;
  busy: boolean;
  onRecrop?: () => void;
  onCaption?: (caption: string) => void;
  onRemove: () => void;
};

export function PhotoTools({ photoKey, caption, busy, onRecrop, onCaption, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(caption ?? "");
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-secondary p-3">
      <div className="flex flex-wrap gap-2">
        {onRecrop && (
          <AppButton color="secondary" size="lg" iconLeading={Crop} onPress={onRecrop} isDisabled={busy}>
            Изменить кадр
          </AppButton>
        )}
        {onCaption && (
          <AppButton color="secondary" size="lg" iconLeading={MessageSquareText} onPress={() => setEditing(true)} isDisabled={busy}>
            Подпись
          </AppButton>
        )}
        <AppButton color="tertiary" size="lg" iconLeading={Trash2} onPress={() => setConfirming(true)} isDisabled={busy}>
          Убрать фото
        </AppButton>
      </div>
      {editing && onCaption && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onCaption(value);
            setEditing(false);
          }}
        >
          <label htmlFor={`caption-${photoKey}`} className="text-md font-semibold text-primary">
            Подпись под фото (необязательно)
          </label>
          <input
            id={`caption-${photoKey}`}
            value={value}
            maxLength={300}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-11 w-full rounded-xl bg-primary p-3 text-md text-primary ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-brand"
          />
          <div className="flex flex-wrap gap-2">
            <AppButton type="submit" size="lg" isDisabled={busy}>
              Сохранить подпись
            </AppButton>
            <AppButton color="secondary" size="lg" onPress={() => setEditing(false)}>
              Отмена
            </AppButton>
          </div>
        </form>
      )}
      {confirming && (
        <div role="alertdialog" aria-labelledby={`remove-${photoKey}`} className="flex flex-col gap-3 rounded-xl bg-accent-50 p-3">
          <p id={`remove-${photoKey}`} className="text-md text-primary">
            Убрать это фото? Его метка уйдёт из текста.
          </p>
          <div className="flex flex-wrap gap-2">
            <AppButton
              color="primary-destructive"
              size="lg"
              iconLeading={Trash2}
              onPress={() => {
                setConfirming(false);
                onRemove();
              }}
            >
              Да, убрать
            </AppButton>
            <AppButton color="secondary" size="lg" onPress={() => setConfirming(false)} autoFocus>
              Отмена
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}
