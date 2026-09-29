import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

// Локаль берём из root-params (Next 16.3) — страницы остаются статическими при cacheComponents.
// В ветке (admin) параметра locale нет → русский. headers()/cookies() здесь не читать: это сделает
// все страницы динамическими.
export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const fromPath = await rootParams.locale();
    if (fromPath === undefined) locale = routing.defaultLocale;
    else if (hasLocale(routing.locales, fromPath)) locale = fromPath;
    else notFound();
  }
  return {
    locale,
    timeZone: "Europe/Moscow",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
