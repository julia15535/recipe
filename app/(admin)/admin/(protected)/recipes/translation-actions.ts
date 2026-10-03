"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/server/auth/owner";
import { translateLater } from "@/lib/server/recipes/translate-later";

/** «Перевести» / «Перевести заново» (ADR-0029) — английская версия по текущему русскому рецепту. */
export async function translateRecipe(form: FormData): Promise<void> {
  await requireOwner();
  await translateLater(z.uuid().parse(form.get("id")), true);
  refresh();
}
