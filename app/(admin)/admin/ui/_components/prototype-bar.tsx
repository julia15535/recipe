import NextLink from "next/link";

import { PROTOTYPE } from "../_demo/demo-catalog";

// Полоска над пробными экранами: напоминает, что рецепты примерные, ведёт к списку экранов; на рецепте —
// оговорка про пересчёт. Прокручивается вместе со страницей (закреплена только шапка сайта).
export function PrototypeBar({ note }: { note?: string }) {
  return (
    <div className="bg-accent-100 text-accent-700">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 px-4 text-sm lg:px-8">
        <p className="mr-auto">
          Пробный экран<span className="max-sm:hidden"> · примерные рецепты</span>
          {note && <span className="max-sm:block"> · {note}</span>}
        </p>
        <NextLink href={PROTOTYPE.index} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Все экраны
        </NextLink>
      </div>
    </div>
  );
}
