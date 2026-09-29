import { defineRouting } from "next-intl/routing";

// ADR-0009/0011: RU основной, EN — вторая версия; префикс всегда (/ru/…, /en/…).
// alternateLinks выключены: hreflang строит metadata страниц от SITE_URL (один источник).
export const routing = defineRouting({
  locales: ["ru", "en"],
  defaultLocale: "ru",
  localePrefix: "always",
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
