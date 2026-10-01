import NextLink from "next/link";

import { PROTOTYPE } from "../_demo/demo-catalog";

// Полоска над пробными экранами: напоминает, что рецепты примерные, и ведёт к списку экранов.
export function PrototypeBar() {
  return (
    <div className="bg-accent-100 text-accent-700">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 text-sm lg:px-8">
        <p>
          Пробный экран<span className="max-sm:hidden"> · примерные рецепты</span>
        </p>
        <NextLink href={PROTOTYPE.index} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Все экраны
        </NextLink>
      </div>
    </div>
  );
}
