import { Clock } from "lucide-react";
import NextLink from "next/link";

import { SectionIcon } from "@/components/catalog/section-icon";
import { cx } from "@/utils/cx";

// Карточка рецепта (2 колонки на телефоне, 4 на компьютере): фото (пока — спокойная заглушка с иконкой
// основного раздела; у прототипов — цветная), основной раздел (ADR-0018), название, время.
export type CardData = { href: string; title: string; time: string | null; section: { code: string; label: string }; tone?: string };

export function RecipeCard({ card }: { card: CardData }) {
  return (
    <NextLink
      href={card.href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div
        aria-hidden
        className={cx(
          "flex aspect-[4/5] items-center justify-center lg:aspect-[4/3]",
          card.tone ? cx("bg-linear-to-br", card.tone) : "bg-brand-50 text-brand-300",
        )}
      >
        {!card.tone && <SectionIcon id={card.section.code} className="size-12" />}
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <span className="text-xs font-semibold tracking-wide text-brand-secondary uppercase">{card.section.label}</span>
        <h3 className="font-display text-lg leading-snug break-words text-primary group-hover:underline">{card.title}</h3>
        {card.time && (
          <span className="flex items-center gap-1 text-sm text-tertiary">
            <Clock className="size-4" aria-hidden />
            {card.time}
          </span>
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
