"use client";

import { ExternalLink, EyeOff, Pencil, Send, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppButton } from "@/components/app-button";

import { changeRecipeStatus, removeDraft } from "../actions";

type Props = { id: string; status: "draft" | "published"; siteHref: string };

// Действия над рецептом: изменить текст, опубликовать / снять, удалить черновик (с подтверждением); у
// опубликованного — «Открыть на сайте» (адрес `/ru/recipe/{slug}` не меняется при правке).
export function RecipeActions({ id, status, siteHref }: Props) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <AppButton color="secondary" iconLeading={Pencil} href={`/admin/recipes/${id}/edit`}>
          Изменить
        </AppButton>
        <form action={changeRecipeStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={status === "draft" ? "published" : "draft"} />
          <AppButton type="submit" color={status === "draft" ? "primary" : "secondary"} iconLeading={status === "draft" ? Send : EyeOff}>
            {status === "draft" ? "Опубликовать" : "Снять с публикации"}
          </AppButton>
        </form>
        {status === "published" && (
          <AppButton color="tertiary" iconLeading={ExternalLink} href={siteHref}>
            Открыть на сайте
          </AppButton>
        )}
        {status === "draft" && !confirming && (
          <AppButton color="tertiary" iconLeading={Trash2} onPress={() => setConfirming(true)}>
            Удалить
          </AppButton>
        )}
      </div>
      {confirming && (
        <div role="alertdialog" aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-xl bg-accent-50 p-4">
          <p id="delete-title" className="text-md text-primary">
            Удалить черновик насовсем? Вернуть его будет нельзя.
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={removeDraft}>
              <input type="hidden" name="id" value={id} />
              <AppButton type="submit" color="primary-destructive" iconLeading={Trash2}>
                Да, удалить
              </AppButton>
            </form>
            <AppButton color="secondary" onPress={() => setConfirming(false)}>
              Отмена
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}
