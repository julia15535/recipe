"use client";

import { Search } from "lucide-react";
import { Link } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { CatalogRibbon } from "@/components/catalog/catalog-ribbon";
import { CatalogSheet } from "@/components/catalog/catalog-sheet";
import type { CatalogSection } from "@/components/catalog/types";

// Шапка сайта = строка «название · поиск · язык» + каталог (владелец 01.10: «шапка это вот это») —
// закреплена целиком при прокрутке на всех страницах. Компьютер (от 1024 px): строка + лента разделов;
// телефон и планшет: одна строка, каталог — привычный значок «меню» слева от названия, по нажатию —
// нижний лист. Слой z-40 — под окнами React Aria (z-50); полная высота — --site-header-height в
// app/globals.css (от неё scroll-padding). Тексты и адреса — от вызывающего (RU/EN или прототип).
type Props = {
  siteName: string;
  homeHref: string;
  searchHref: string;
  searchLabel: string;
  language: { href: string; label: string; name: string; lang: string };
  catalog?: { sections: CatalogSection[]; label: string; closeLabel: string };
};

export function SiteHeader({ siteName, homeHref, searchHref, searchLabel, language, catalog }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-secondary bg-page pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center gap-1 px-4 sm:gap-2 lg:px-8">
        {catalog && (
          <CatalogSheet sections={catalog.sections} label={catalog.label} closeLabel={catalog.closeLabel} className="lg:hidden" />
        )}
        <Link
          href={homeHref}
          className="mr-auto inline-flex min-h-11 items-center rounded-lg font-display text-md whitespace-nowrap text-primary outline-brand focus-visible:outline-2 min-[360px]:text-xl lg:text-display-xs"
        >
          {siteName}
        </Link>
        <AppButton color="secondary" size="lg" href={searchHref} iconLeading={Search} aria-label={searchLabel} className="sm:hidden" />
        <AppButton color="secondary" href={searchHref} iconLeading={Search} className="max-sm:hidden">
          {searchLabel}
        </AppButton>
        <AppButton color="tertiary" size="lg" href={language.href} aria-label={language.name} lang={language.lang}>
          {language.label}
        </AppButton>
      </div>
      {catalog && <CatalogRibbon sections={catalog.sections} label={catalog.label} className="max-lg:hidden" />}
    </header>
  );
}
