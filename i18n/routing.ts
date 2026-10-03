import { defineRouting } from "next-intl/routing";

// ADR-0009/0011: RU основной, EN — вторая версия; префикс всегда (/ru/…, /en/…).
// alternateLinks выключены: hreflang строит metadata страниц от SITE_URL (один источник).
// `/` — по языку браузера и сохранённому выбору (cookie на год): английский телефон → /en (владелец 03.10, ADR-0029).
export const routing = defineRouting({
  locales: ["ru", "en"],
  defaultLocale: "ru",
  localePrefix: "always",
  localeDetection: true,
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

/** Языки, на которых сайт есть: hreflang и страницы. */
export const LIVE_LOCALES: readonly Locale[] = ["ru", "en"];

export const isLocale = (value: string): value is Locale => (routing.locales as readonly string[]).includes(value);
