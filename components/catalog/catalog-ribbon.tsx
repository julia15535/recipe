"use client";

import { Link } from "react-aria-components";

import { cx } from "@/utils/cx";

import { sectionIcon } from "./section-icons";
import type { CatalogSection } from "./types";

const CELL = "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-center text-sm font-medium";

// Каталог на компьютере — лента на всю ширину экрана (решение владельца 01.10, ADR-0018): всегда 11
// мест; пустой раздел — бледный и не ссылка, название читаемое (ADR-0020).
export function CatalogRibbon({ sections, label, className }: { sections: CatalogSection[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cx("border-y border-secondary bg-primary", className)}>
      <ul className="mx-auto grid w-full max-w-7xl auto-cols-fr grid-flow-col gap-1 px-4 py-2 lg:px-8">
        {sections.map((section) => {
          const Icon = sectionIcon(section.id);
          return (
            <li key={section.id}>
              {section.empty ? (
                <span className={cx(CELL, "text-quaternary")} data-empty>
                  <Icon className="size-6 text-brand-secondary opacity-35" aria-hidden />
                  {section.label}
                  <span className="sr-only">, пока нет рецептов</span>
                </span>
              ) : (
                <Link
                  href={section.href}
                  className={cx(
                    CELL,
                    "text-secondary outline-brand transition duration-100 ease-linear hover:bg-accent-50 hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2",
                  )}
                >
                  <Icon className="size-6 text-brand-secondary" aria-hidden />
                  {section.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
