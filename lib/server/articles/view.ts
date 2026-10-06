import "server-only";

import type { ArticlePhotoView, ArticleView } from "@/components/article/view";
import type { CardData } from "@/components/recipe/recipe-card";
import { photoAlts } from "@/lib/domain/article-text/assemble";
import type { ArticleBody } from "@/lib/domain/article-text/types";

import type { ArticlePhoto } from "./photo-reads";

/** Статья для показа: только фото, на которые есть метка в тексте (фото «без места» на сайте не видны). */
export function toArticleView(title: string, body: ArticleBody, photos: ReadonlyMap<string, ArticlePhoto>, recipes: CardData[]): ArticleView {
  const alts = photoAlts(body, title, new Map([...photos].map(([key, photo]) => [key, photo.caption])));
  const shown: Record<string, ArticlePhotoView> = {};
  for (const block of body.blocks) {
    const photo = block.type === "photo" ? photos.get(block.key) : undefined;
    if (photo) shown[photo.key] = { ref: photo.ref, caption: photo.caption, alt: alts.get(photo.key) ?? title };
  }
  return { title, blocks: body.blocks, photos: shown, recipes };
}

/** Первое фото статьи в порядке текста — для карточки и превью ссылки. */
export function coverOf(body: ArticleBody, photos: ReadonlyMap<string, ArticlePhoto> | undefined): ArticlePhoto | null {
  for (const block of body.blocks) {
    const photo = block.type === "photo" ? photos?.get(block.key) : undefined;
    if (photo) return photo;
  }
  return null;
}
