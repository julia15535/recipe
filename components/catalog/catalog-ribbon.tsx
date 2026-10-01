"use client";

import { Link } from "react-aria-components";

import { cx } from "@/utils/cx";

import { SectionIcon } from "./section-icon";
import type { CatalogSection } from "./types";

const CELL = "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-center text-sm font-medium";

// Каталог на компьютере — лента на всю ширину экрана в закреплённой шапке (решение владельца 01.10,
// ADR-0018), компактная (ячейка 64 px), чтобы шапка была не выше 150 px: всегда 11
// мест; пустой раздел — бледный и не ссылка, название читаемое (ADR-0020); текущий — выделен, не ссылка.
export function CatalogRibbon({ sections, label, className }: { sections: CatalogSection[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cx("border-t border-secondary bg-primary", className)}>
      <ul className="mx-auto grid w-full max-w-7xl auto-cols-fr grid-flow-col gap-1 px-4 py-1 lg:px-8">
        {sections.map((section) => (
          <li key={section.id}>
            <RibbonCell section={section} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RibbonCell({ section }: { section: CatalogSection }) {
  if (section.current)
    return (
      <span aria-current="page" className={cx(CELL, "bg-accent-100 text-primary")} data-current>
        <SectionIcon id={section.id} className="size-5 text-brand-secondary" />
        {section.label}
      </span>
    );
  if (section.empty)
    return (
      <span className={cx(CELL, "text-quaternary")} data-empty>
        <SectionIcon id={section.id} className="size-5 text-brand-secondary opacity-35" />
        {section.label}
        <span className="sr-only">, пока нет рецептов</span>
      </span>
    );
  return (
    <Link
      href={section.href}
      className={cx(
        CELL,
        "text-secondary outline-brand transition duration-100 ease-linear hover:bg-accent-50 hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2",
      )}
    >
      <SectionIcon id={section.id} className="size-5 text-brand-secondary" />
      {section.label}
    </Link>
  );
}
