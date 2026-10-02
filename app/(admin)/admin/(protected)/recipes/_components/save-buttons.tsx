"use client";

import { ArrowLeft, Check, Send } from "lucide-react";

import { AppButton } from "@/components/app-button";

type Props = { editing: boolean; ready: boolean; pending: boolean; onBack: () => void; onSave: (publish: boolean) => void };

/** «Исправить текст» и сохранение: новый рецепт — черновик или публикация, правка — «Сохранить». */
export function SaveButtons({ editing, ready, pending, onBack, onSave }: Props) {
  const blocked = pending || !ready;
  return (
    <div className="flex flex-wrap gap-3">
      <AppButton color="secondary" iconLeading={ArrowLeft} onPress={onBack} isDisabled={pending}>
        Исправить текст
      </AppButton>
      {editing ? (
        <AppButton iconLeading={Check} onPress={() => onSave(false)} isDisabled={blocked}>
          Сохранить
        </AppButton>
      ) : (
        <>
          <AppButton color="secondary" iconLeading={Check} onPress={() => onSave(false)} isDisabled={blocked}>
            Сохранить черновик
          </AppButton>
          <AppButton iconLeading={Send} onPress={() => onSave(true)} isDisabled={blocked}>
            Опубликовать
          </AppButton>
        </>
      )}
    </div>
  );
}
