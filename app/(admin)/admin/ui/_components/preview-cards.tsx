import { Clock } from "lucide-react";

import { QuickBadge } from "./quick-badge";

// Фото-карточки рецептов (фото главное, 2 колонки на телефоне). Вместо фото — цветные заглушки из
// палитры (олива + персик): настоящих снимков блюд пока нет.
const CARDS = [
  { title: "Сырники со сметаной", category: "Завтраки", time: "25 мин", quick: true, tone: "from-accent-200 to-accent-400" },
  { title: "Суп с белыми грибами", category: "Супы", time: "1 ч", quick: false, tone: "from-brand-200 to-brand-400" },
  { title: "Салат с запечённой тыквой", category: "Салаты", time: "35 мин", quick: false, tone: "from-accent-100 to-brand-200" },
  { title: "Курица с травами", category: "Вторые блюда", time: "50 мин", quick: false, tone: "from-brand-100 to-accent-300" },
];

export function PreviewCards() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-display-xs font-semibold text-primary">Популярное</h2>
      <ul className="grid grid-cols-2 gap-3">
        {CARDS.map((card) => (
          <li key={card.title} className="overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary">
            <div className={`aspect-[4/5] bg-linear-to-br ${card.tone}`} aria-hidden />
            <div className="flex flex-col gap-1.5 p-3">
              <span className="text-xs font-semibold tracking-wide text-brand-secondary uppercase">{card.category}</span>
              <h3 className="font-display text-lg leading-snug font-semibold text-primary">{card.title}</h3>
              <span className="flex items-center gap-1 text-sm text-tertiary">
                <Clock className="size-4" aria-hidden />
                {card.time}
              </span>
              {card.quick && <QuickBadge />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
