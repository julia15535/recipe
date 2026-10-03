"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

// Выбор языка запоминается (владелец 03.10, ADR-0029): кнопка RU/EN переходит без перезагрузки страницы, а next-intl
// пишет cookie только при полной загрузке — поэтому язык открытой страницы сохраняем здесь. По ней `/` ведёт на этот
// язык и в следующий раз.
const COOKIE = "NEXT_LOCALE";
const YEAR = 60 * 60 * 24 * 365;

export function LocaleCookie() {
  const locale = useLocale();
  useEffect(() => {
    const current = document.cookie.split("; ").find((item) => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (current !== locale) document.cookie = `${COOKIE}=${locale}; path=/; max-age=${YEAR}; samesite=lax`;
  }, [locale]);
  return null;
}
