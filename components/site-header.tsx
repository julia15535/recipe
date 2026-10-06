"use client";

import { Search } from "lucide-react";
import { Link } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { CatalogRibbon } from "@/components/catalog/catalog-ribbon";
import { CatalogSheet } from "@/components/catalog/catalog-sheet";
import type { CatalogSection } from "@/components/catalog/types";
import { cx } from "@/utils/cx";

// Шапка сайта = строка «название · поиск · язык» + каталог (владелец 01.10: «шапка это вот это») —
// закреплена целиком при прокрутке на всех страницах. Компьютер (от 1024 px): строка + лента разделов;
// телефон и планшет: одна строка, каталог — привычный значок «меню» слева от названия, по нажатию —
// нижний лист. Слой z-40 — под окнами React Aria (z-50); полная высота — --site-header-height в
// app/globals.css (от неё scroll-padding). Тексты и адреса — от вызывающего (RU/EN или прототип); кнопка языка
// RU/EN — адрес той же страницы на другом языке (ADR-0029). Логотип — название и под ним подпись автора
// каллиграфией (владелец 03.10, ADR-0033): на телефоне — у правого края названия, с 640 px — как в образце
// владельца, с середины «рецептов» (ru 68 %, en 64 % ширины названия); выступ справа — в отступе ссылки,
// чтобы рамка фокуса и соседние кнопки его учитывали.
type Props = {
  siteName: string;
  signature?: { text: string; locale: "ru" | "en" };
  homeHref: string;
  searchHref: string;
  searchLabel: string;
  language?: { href: string; label: string; name: string; lang: string };
  /** «Статьи» (ADR-0034): на компьютере — ссылкой перед «Поиск», на телефоне — строкой в листе каталога. */
  articles?: { href: string; label: string };
  catalog?: { sections: CatalogSection[]; label: string; closeLabel: string };
};

export function SiteHeader({ siteName, signature, homeHref, searchHref, searchLabel, language, catalog, articles }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-secondary bg-page pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center gap-1 px-4 sm:gap-2 lg:h-19 lg:px-8">
        {catalog && (
          <CatalogSheet sections={catalog.sections} label={catalog.label} closeLabel={catalog.closeLabel} className="lg:hidden" extra={articles} />
        )}
        <Link
          href={homeHref}
          aria-label={signature ? `${siteName} ${signature.text}` : undefined}
          className={cx(
            "mr-auto inline-grid min-h-11 content-center rounded-lg text-primary outline-brand focus-visible:outline-2",
            // Снизу 4 px: наклонённая подпись выступает за свою строку — рамка фокуса охватывает и её.
            signature && "pb-1",
            signature && "sm:pr-18 lg:pr-16",
          )}
        >
          <span data-logo-title className="pt-1.5 font-display text-md leading-tight whitespace-nowrap min-[360px]:text-xl lg:pt-3 lg:text-display-xs lg:leading-tight">
            {siteName}
          </span>
          {signature && (
            <span
              data-logo-signature
              className={cx(
                "mt-1 mr-2 -rotate-4 justify-self-end font-signature text-[1.5rem] leading-none whitespace-nowrap text-signature min-[360px]:mr-0 min-[360px]:text-[1.625rem] sm:mt-0 sm:justify-self-start",
                signature.locale === "en" ? "sm:ml-[64%]" : "sm:ml-[68%]",
              )}
            >
              {signature.text}
            </span>
          )}
        </Link>
        {articles && (
          <AppButton color="tertiary" href={articles.href} className="max-lg:hidden">
            {articles.label}
          </AppButton>
        )}
        <AppButton color="secondary" size="lg" href={searchHref} iconLeading={Search} aria-label={searchLabel} className="sm:hidden" />
        <AppButton color="secondary" href={searchHref} iconLeading={Search} className="max-sm:hidden">
          {searchLabel}
        </AppButton>
        {language && (
          <AppButton color="tertiary" size="lg" href={language.href} aria-label={language.name} lang={language.lang}>
            {language.label}
          </AppButton>
        )}
      </div>
      {catalog && <CatalogRibbon sections={catalog.sections} label={catalog.label} className="max-lg:hidden" />}
    </header>
  );
}
