import "server-only";
import { eq } from "drizzle-orm";

import * as t from "@/lib/server/db/schema";

// Общее для публичных чтений (ADR-0027, ADR-0029): языки сайта, условие «опубликован», адреса страниц.
export type Locale = "ru" | "en";
export const published = eq(t.recipes.status, "published");
export const sectionPath = (locale: Locale, slug: string) => `/${locale}/catalog/${slug}`;
export const recipePath = (locale: Locale, slug: string) => `/${locale}/recipe/${slug}`;
