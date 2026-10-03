import "server-only";
import { getLocale } from "next-intl/server";

import { isLocale } from "@/i18n/routing";
import type { Locale } from "@/lib/server/recipes/public";

/** Язык страницы из адреса (`next/root-params`, статически); неизвестный сюда не доходит — 404 в i18n/request.ts. */
export async function pageLocale(): Promise<Locale> {
  const locale = await getLocale();
  return isLocale(locale) ? locale : "ru";
}

export const otherLocale = (locale: Locale): Locale => (locale === "ru" ? "en" : "ru");
