import { BookOpen } from "lucide-react";
import NextLink from "next/link";

import { RecipePhoto } from "@/components/recipe/recipe-photo";
import type { PhotoRef } from "@/lib/domain/photo";

// Карточка статьи (ADR-0034): первое фото статьи 4:3 (без фото — спокойная заглушка с книгой), название, анонс —
// первые строки текста. Сетка — как у рецептов: 1 колонка на телефоне, 3 на компьютере.
export type ArticleCardData = { href: string; title: string; excerpt: string | null; photo: PhotoRef | null };

const SIZES = "(min-width: 1024px) 400px, 100vw";

export function ArticleCard({ card }: { card: ArticleCardData }) {
  return (
    <NextLink
      href={card.href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {card.photo ? (
        <RecipePhoto photo={card.photo} alt="" sizes={SIZES} />
      ) : (
        <div aria-hidden className="flex aspect-[4/3] items-center justify-center bg-brand-50 text-brand-300">
          <BookOpen className="size-12" />
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="font-display text-xl leading-snug break-words text-primary group-hover:underline">{card.title}</h3>
        {card.excerpt && <p className="line-clamp-3 text-md text-tertiary">{card.excerpt}</p>}
      </div>
    </NextLink>
  );
}

export function ArticleGrid({ cards }: { cards: ArticleCardData[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {cards.map((card) => (
        <li key={card.href}>
          <ArticleCard card={card} />
        </li>
      ))}
    </ul>
  );
}
