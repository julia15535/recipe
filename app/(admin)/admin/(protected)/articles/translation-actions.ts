"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { translateArticleLater } from "@/lib/server/articles/translate-later";
import { requireOwner } from "@/lib/server/auth/owner";

/** «Перевести» / «Перевести заново» (ADR-0038) — английская версия по текущей русской статье. */
export async function translateArticle(form: FormData): Promise<void> {
  await requireOwner();
  await translateArticleLater(z.uuid().parse(form.get("id")), true);
  refresh();
}
