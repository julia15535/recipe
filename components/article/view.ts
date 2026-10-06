// Модель показа статьи (ADR-0034) — одна для предпросмотра в кабинете и сайта: блоки из разбора, фото по коду
// метки (с подписью и alt), карточки связанных опубликованных рецептов.
import type { CardData } from "@/components/recipe/recipe-card";
import type { ArticleBlock } from "@/lib/domain/article-text/types";
import type { PhotoRef } from "@/lib/domain/photo";

export type ArticlePhotoView = { ref: PhotoRef; caption: string | null; alt: string };

export type ArticleView = {
  title: string;
  blocks: ArticleBlock[];
  photos: Record<string, ArticlePhotoView>;
  recipes: CardData[];
};
