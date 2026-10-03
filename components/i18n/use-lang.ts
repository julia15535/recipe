"use client";

import { useLocale } from "next-intl";

import type { Lang } from "@/lib/domain/lang";

/** Язык страницы для доменных форматов (числа, формы слов, единицы): кабинет и прототипы — русский. */
export const useLang = (): Lang => (useLocale() === "en" ? "en" : "ru");
