import { defineRouting } from "next-intl/routing";

// ADR-0009/0011: RU основной, EN — вторая версия; префикс всегда (/ru/…, /en/…).
// alternateLinks выключены: hreflang строит metadata страниц от SITE_URL (один источник).
// Пока английской версии нет (план public-pages, ADR-0027), `/` всегда ведёт на /ru: язык браузера и cookie не
// учитываем — посетитель из Инстаграма видит русский сайт, а не заглушку. Вернём с английской версией.
export const routing = defineRouting({
  locales: ["ru", "en"],
  defaultLocale: "ru",
  localePrefix: "always",
  localeDetection: false,
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

/** Языки, на которых сайт уже есть: hreflang и страницы. EN — заглушка `/en` (noindex). */
export const LIVE_LOCALES: readonly Locale[] = ["ru"];
