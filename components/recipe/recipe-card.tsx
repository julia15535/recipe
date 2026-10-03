import { Clock } from "lucide-react";
import NextLink from "next/link";

import { SectionIcon } from "@/components/catalog/section-icon";
import type { PhotoRef } from "@/lib/domain/photo";
import { cx } from "@/utils/cx";

import { type CompositionTag, CompositionTags } from "./composition-tags";
import { RecipePhoto } from "./recipe-photo";

// Карточка рецепта (2 колонки на телефоне, 4 на компьютере): фото 4:3 — кадр владельца (ADR-0028), без фото —
// спокойная заглушка с иконкой основного раздела (у прототипов — цветная); основной раздел (ADR-0018), название;
// под названием — время и первый тег состава автора (решение владельца 03.10, ADR-0030).
export type CardData = {
  href: string;
  title: string;
  time: string | null;
  section: { code: string; label: string };
  photo?: PhotoRef | null;
  tag?: CompositionTag | null;
  tone?: string;
};

const CARD_SIZES = "(min-width: 1280px) 296px, (min-width: 1024px) 23vw, 50vw";

export function RecipeCard({ card }: { card: CardData }) {
  return (
    <NextLink
      href={card.href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {card.photo ? (
        <RecipePhoto photo={card.photo} alt="" sizes={CARD_SIZES} />
      ) : (
        <div
          aria-hidden
          className={cx("flex aspect-[4/3] items-center justify-center", card.tone ? cx("bg-linear-to-br", card.tone) : "bg-brand-50 text-brand-300")}
        >
          {!card.tone && <SectionIcon id={card.section.code} className="size-12" />}
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-3">
        <span className="text-xs font-semibold tracking-wide text-brand-secondary uppercase">{card.section.label}</span>
        <h3 className="font-display text-lg leading-snug break-words text-primary group-hover:underline">{card.title}</h3>
        {(card.time || card.tag) && (
          <div className="flex flex-wrap items-center gap-2">
            {card.time && (
              <span className="flex items-center gap-1 text-sm text-tertiary">
                <Clock className="size-4" aria-hidden />
                {card.time}
              </span>
            )}
            {/* Имя списка = сам тег: внутри ссылки оно входит в её название («…, Белок»), не подменяя его. */}
            {card.tag && <CompositionTags tags={[card.tag]} label={card.tag.label} />}
          </div>
        )}
      </div>
    </NextLink>
  );
}

export function RecipeGrid({ cards }: { cards: CardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
      {cards.map((card) => (
        <li key={card.href}>
          <RecipeCard card={card} />
        </li>
      ))}
    </ul>
  );
}
