"use client";

import { ExternalLink, EyeOff, Pencil, Send, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppButton } from "@/components/app-button";

import { changeArticleStatus, removeArticleDraft } from "../actions";

// Действия над статьёй: изменить текст, опубликовать / снять, удалить черновик (с подтверждением); у опубликованной —
// «Открыть на сайте».
export function ArticleActions({ id, status, siteHref }: { id: string; status: "draft" | "published"; siteHref: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <AppButton color="secondary" iconLeading={Pencil} href={`/admin/articles/${id}/edit`}>
          Изменить
        </AppButton>
        <form action={changeArticleStatus}>
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
        <div role="alertdialog" aria-labelledby="delete-article" className="flex flex-col gap-3 rounded-xl bg-accent-50 p-4">
          <p id="delete-article" className="text-md text-primary">
            Удалить черновик статьи насовсем вместе с фото? Вернуть его будет нельзя.
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={removeArticleDraft}>
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
