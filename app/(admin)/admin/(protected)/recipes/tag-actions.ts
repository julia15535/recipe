"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { isTagCode, TAG_CODES, type TagCode } from "@/lib/domain/catalog";
import { byteLength, LIMITS } from "@/lib/domain/recipe-text/limits";
import { orderTags, retagText, withoutCatalogLines } from "@/lib/domain/recipe-text/retag";
import { releaseAiTurn, takeAiTurn } from "@/lib/server/ai/one-at-a-time";
import { suggestTagsWithAi } from "@/lib/server/ai/suggest-tags";
import { countArticleImportsLastHour } from "@/lib/server/articles/imports";
import { requireOwner } from "@/lib/server/auth/owner";
import { allow } from "@/lib/server/auth/rate-limit";
import { StorageError } from "@/lib/server/db/errors";
import { getAiConfig } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { catalogLabels, getCatalog } from "@/lib/server/recipes/catalog";
import { countImportsLastHour, IMPORTS_PER_HOUR } from "@/lib/server/recipes/imports";
import { refreshPublicSite } from "@/lib/server/recipes/public-cache";
import { getRecipe } from "@/lib/server/recipes/queries";
import { setRecipeTags } from "@/lib/server/recipes/tags";

// Блок «Теги состава» на странице рецепта (план recipe-tags-button, ADR-0036): «Подобрать с ИИ» только предлагает,
// «Сохранить теги» пишет выбор владельца. Каждое действие — requireOwner(); текст рецепта читает сервер (из браузера —
// только id, revision и коды тегов).
export type TagsResult = { ok: true; tags: TagCode[]; revision: number } | { ok: false; message: string };

const target = z.object({ id: z.uuid(), revision: z.number().int().positive() });
const saveInput = target.extend({ tags: z.array(z.enum(TAG_CODES)).max(TAG_CODES.length) });
const HOUR = 60 * 60 * 1000;
const CONFLICT = "Рецепт уже изменён в другой вкладке — обновите страницу.";
const MESSAGES: Record<string, string> = {
  broken: "Не получилось — обновите страницу и попробуйте ещё раз.",
  gone: "Рецепт не найден — возможно, его удалили.",
  disabled: "Подбор через ИИ сейчас выключен — отметьте теги сами.",
  busy: "ИИ ещё занят другим запросом — подождите несколько секунд.",
  limit: "Слишком много запросов к ИИ за час — подождите немного или отметьте теги сами.",
  empty: "В рецепте нет текста для подбора.",
  "too-large": "Рецепт слишком длинный для подбора — отметьте теги сами.",
  timeout: "ИИ думал слишком долго. Нажмите «Подобрать с ИИ» ещё раз.",
  rate: "ИИ сейчас перегружен. Попробуйте через минуту.",
  server: "У ИИ сбой. Попробуйте через минуту.",
  auth: "ИИ не принимает наш ключ — напишите мне, я проверю.",
  storage: "Не получилось сохранить — попробуйте ещё раз. Отметки на месте.",
};
const FALLBACK = "Не удалось связаться с ИИ. Попробуйте ещё раз или отметьте теги сами.";
const fail = (reason: string): TagsResult => ({ ok: false, message: MESSAGES[reason] ?? FALLBACK });

/** «Подобрать с ИИ»: теги по составу; ничего не сохраняет. Рецепт изменили, пока ИИ думал, — предложение не показываем. */
export async function suggestRecipeTags(input: z.input<typeof target>): Promise<TagsResult> {
  await requireOwner();
  const fields = target.safeParse(input);
  if (!fields.success) return fail("broken");
  const { id, revision } = fields.data;
  const config = getAiConfig();
  if (!config) return fail("disabled");
  if (!takeAiTurn()) return fail("busy");
  try {
    // Лимит общий с разборами рецептов и статей (ADR-0034): подборы считаются в памяти, в БД — только разборы.
    const used = (await countImportsLastHour()) + (await countArticleImportsLastHour());
    if (used >= IMPORTS_PER_HOUR || !allow("ai-parse", IMPORTS_PER_HOUR, HOUR)) return fail("limit");
    const recipe = await getRecipe(id);
    if (!recipe) return fail("gone");
    if (recipe.revision !== revision) return { ok: false, message: CONFLICT };
    const answer = await suggestTagsWithAi(withoutCatalogLines(recipe.sourceText), config);
    if (!answer.ok) return fail(answer.reason);
    if ((await getRecipe(id))?.revision !== revision) return { ok: false, message: CONFLICT };
    return { ok: true, tags: answer.tags, revision };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("теги: подбор не удался", { pg: error.code });
    return fail("storage");
  } finally {
    releaseAiTurn();
  }
}

/** «Сохранить теги»: порядок считает сервер (прежние — как у автора, новые — в конец), строка «Теги:» в тексте — тоже. */
export async function saveRecipeTags(input: z.input<typeof saveInput>): Promise<TagsResult> {
  await requireOwner();
  const fields = saveInput.safeParse(input);
  if (!fields.success) return fail("broken");
  const { id, revision } = fields.data;
  try {
    const recipe = await getRecipe(id);
    if (!recipe) return fail("gone");
    if (recipe.revision !== revision) return { ok: false, message: CONFLICT };
    const current = recipe.view.tags.map((tag) => tag.id).filter(isTagCode);
    const tags = orderTags(current, fields.data.tags);
    if (tags.join() === current.join()) return { ok: true, tags, revision };
    const retagged = retagText(recipe.sourceText, tags, catalogLabels(await getCatalog()));
    if (!retagged.ok || byteLength(retagged.text) > LIMITS.bytes) {
      return { ok: false, message: "Не получилось поправить строку «Теги:» в тексте рецепта — поменяйте теги через «Изменить»." };
    }
    const saved = await setRecipeTags(id, revision, tags, retagged.text);
    if (!saved.ok) return saved.reason === "conflict" ? { ok: false, message: CONFLICT } : fail("gone");
    refreshPublicSite();
    refresh();
    return { ok: true, tags, revision: saved.revision };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("теги: не сохранены", { pg: error.code });
    return fail("storage");
  }
}
