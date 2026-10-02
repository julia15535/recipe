"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { draftToView } from "@/components/recipe/from-draft";
import type { RecipeView } from "@/components/recipe/view";
import type { Issue } from "@/lib/domain/recipe-text/issues";
import { parseRecipeText } from "@/lib/domain/recipe-text/parse";
import { requireOwner } from "@/lib/server/auth/owner";
import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";
import { catalogLabels, getCatalog } from "@/lib/server/recipes/catalog";
import { refreshPublicSite } from "@/lib/server/recipes/public-cache";
import { createRecipe, replaceRecipe } from "@/lib/server/recipes/save";
import { deleteDraft, setRecipeStatus } from "@/lib/server/recipes/status";

// Действия кабинета с рецептами (план recipe-upload). Каждое — requireOwner(); сохранение заново
// разбирает присланный ТЕКСТ: готовые ингредиенты, статус, адрес или id разделов от браузера не берём.
// После каждой успешной записи — refreshPublicSite(): сайт сразу видит публикацию, правку, снятие.
export type Preview = { ok: boolean; issues: Issue[]; view: RecipeView | null };
export type SaveResult = { ok: true; id: string } | { ok: false; issues: Issue[]; message: string | null };

// Длину проверяет разбор (20 КБ в байтах, понятным замечанием); тело Server Action Next и так ≤ 1 МБ.
const text = z.string().catch("");
const id = z.uuid();
const FAILED: SaveResult = { ok: false, issues: [], message: "Не получилось сохранить — попробуйте ещё раз. Текст на месте." };

/** Сбой БД — понятное сообщение в редакторе (текст не теряется), в лог — только код Postgres. */
async function safely(work: () => Promise<SaveResult>): Promise<SaveResult> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("рецепт не сохранён", { pg: error.code });
    return FAILED;
  }
}

export async function previewRecipe(input: string): Promise<Preview> {
  await requireOwner();
  const result = parseRecipeText(text.parse(input));
  return { ok: result.ok, issues: result.issues, view: draftToView(result, catalogLabels(await getCatalog())) };
}

export async function saveNewRecipe(input: string, publish: boolean): Promise<SaveResult> {
  await requireOwner();
  const source = text.parse(input);
  const result = parseRecipeText(source);
  if (!result.ok) return { ok: false, issues: result.issues, message: null };
  const parsed = result;
  return safely(async () => {
    const saved = await createRecipe(parsed, source, publish === true ? "published" : "draft");
    if (!saved.ok) return FAILED;
    refreshPublicSite();
    return { ok: true, id: saved.id };
  });
}

export async function saveRecipeText(recipeId: string, revision: number, input: string): Promise<SaveResult> {
  await requireOwner();
  const source = text.parse(input);
  const result = parseRecipeText(source);
  if (!result.ok) return { ok: false, issues: result.issues, message: null };
  const target = id.safeParse(recipeId);
  const expected = z.number().int().positive().safeParse(revision);
  if (!target.success || !expected.success) return FAILED;
  const parsed = result;
  return safely(async () => {
    const saved = await replaceRecipe(target.data, expected.data, parsed, source);
    if (saved.ok) {
      refreshPublicSite();
      return { ok: true, id: saved.id };
    }
    const message =
      saved.reason === "conflict" ? "Рецепт уже изменён в другой вкладке — обновите страницу." : "Рецепт не найден — возможно, его удалили.";
    return { ok: false, issues: [], message };
  });
}

const statusForm = z.object({ id, status: z.enum(["draft", "published"]) });

export async function changeRecipeStatus(form: FormData): Promise<void> {
  await requireOwner();
  const { id: recipeId, status } = statusForm.parse({ id: form.get("id"), status: form.get("status") });
  await setRecipeStatus(recipeId, status);
  refreshPublicSite();
  refresh();
}

export async function removeDraft(form: FormData): Promise<void> {
  await requireOwner();
  await deleteDraft(id.parse(form.get("id")));
  refreshPublicSite();
  redirect("/admin");
}
