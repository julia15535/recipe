"use client";

import { Search } from "lucide-react";
import { Link } from "react-aria-components";

import { AppButton } from "@/components/app-button";

// Шапка сайта (решение владельца 01.10): название ведёт на главную, поиск — кнопкой-лупой (не полем
// на главной), рядом переключатель языка. Закреплена вверху при прокрутке на всех страницах: слой ниже
// окон React Aria (z-50), отступ под «чёлку», высота — --site-header-height (app/globals.css) для
// scroll-padding. Тексты и адреса — от вызывающего (RU/EN или прототип).
type Props = {
  siteName: string;
  homeHref: string;
  searchHref: string;
  searchLabel: string;
  language: { href: string; label: string; name: string; lang: string };
};

export function SiteHeader({ siteName, homeHref, searchHref, searchLabel, language }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-secondary bg-page pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-(--site-header-height) w-full max-w-7xl items-center gap-2 px-4 lg:px-8">
        <Link
          href={homeHref}
          className="mr-auto inline-flex min-h-11 items-center rounded-lg font-display text-xl text-primary outline-brand focus-visible:outline-2 lg:text-display-xs"
        >
          {siteName}
        </Link>
        <AppButton color="secondary" href={searchHref} iconLeading={Search} aria-label={searchLabel} className="sm:hidden" />
        <AppButton color="secondary" href={searchHref} iconLeading={Search} className="max-sm:hidden">
          {searchLabel}
        </AppButton>
        <AppButton color="tertiary" href={language.href} aria-label={language.name} lang={language.lang}>
          {language.label}
        </AppButton>
      </div>
    </header>
  );
}
