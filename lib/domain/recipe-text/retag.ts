// Теги состава в тексте рецепта (план recipe-tags-button, ADR-0036). «Сохранить теги» меняет только строку каталога,
// остальной текст владельца — байт в байт (и переводы строк); иначе «Изменить» → «Разобрать» вернул бы старые теги.
import { TAG_CODES, type TagCode } from "../catalog";
import { splitBlocks } from "./blocks";
import type { Labels } from "./from-ai";
import { type ParseResult, parseRecipeText } from "./parse";

// Строки каталога — как их узнаёт разбор (`blocks.ts`): «Теги:», «Разделы:», «Категория:»…; в шагах не узнаются.
const CATALOG_KEYS = new Set(["теги", "тег", "разделы", "раздел", "категории", "категория"]);

type Row = { text: string; end: string };

/** Строки с их переводом строки («» у последней) — чтобы собрать текст обратно без потерь. */
function rowsOf(source: string): Row[] {
  const parts = source.split(/(\r?\n)/);
  const rows: Row[] = [];
  for (let index = 0; index < parts.length; index += 2) rows.push({ text: parts[index] ?? "", end: parts[index + 1] ?? "" });
  return rows;
}

function joinRows(rows: Row[], lastEnd: string): string {
  return rows.map((row, index) => row.text + (index === rows.length - 1 ? lastEnd : row.end)).join("");
}

/** Номера строк каталога, с нуля. */
function catalogLines(source: string): number[] {
  return splitBlocks(source)
    .keys.filter((key) => CATALOG_KEYS.has(key.key))
    .map((key) => key.line.n - 1);
}

/** Текст без строк каталога — вход ИИ-подбора: прежние теги (названные — «ставь всегда») не подсказывают ответ. */
export function withoutCatalogLines(source: string): string {
  const drop = new Set(catalogLines(source));
  const rows = rowsOf(source);
  return joinRows(
    rows.filter((_, index) => !drop.has(index)),
    rows.at(-1)?.end ?? "",
  );
}

/** Порядок записи: оставшиеся теги — как были у автора (первый — на карточке, ADR-0030), новые — в конец по каталогу. */
export function orderTags(current: readonly TagCode[], selected: readonly TagCode[]): TagCode[] {
  const chosen = new Set(selected);
  return [...current.filter((code) => chosen.has(code)), ...TAG_CODES.filter((code) => chosen.has(code) && !current.includes(code))];
}

// Всё, что разбор понял из текста, кроме тегов: номера строк сдвигаются, неизвестные слова строки каталога уходят.
const shape = (result: ParseResult) =>
  JSON.stringify({
    draft: { ...result.draft, tags: [], ingredients: result.draft.ingredients.map((item) => ({ ...item, line: 0 })) },
    main: result.mainIndex,
    issues: result.issues.map((item) => item.code).filter((code) => code !== "unknown-tag"),
  });

export type Retag = { ok: true; text: string } | { ok: false };

/**
 * Первая строка каталога → «Теги: разделы, теги» (слова — как в `toCanonicalText`), остальные строки каталога убираются.
 * Строки нет — отказ (без неё у рецепта нет раздела, такой не сохраняется). Новый текст обязан разобраться в тот же
 * рецепт с ровно этими тегами; отличия в остальном (или текст не разбирается вовсе) — отказ, ничего не меняем.
 */
export function retagText(source: string, tags: readonly TagCode[], labels: Labels): Retag {
  const found = catalogLines(source);
  const first = found[0];
  const before = parseRecipeText(source);
  if (first === undefined || before.draft.title === "") return { ok: false };
  const words = [...before.draft.sections.map((code) => labels.sections.get(code)), ...tags.map((code) => labels.tags.get(code))];
  if (words.some((word) => !word)) return { ok: false };
  const line = `Теги: ${words.join(", ").toLowerCase()}`;
  const rows = rowsOf(source);
  const drop = new Set(found.slice(1));
  const next = rows.flatMap((row, index) => (drop.has(index) ? [] : [index === first ? { ...row, text: line } : row]));
  const text = joinRows(next, rows.at(-1)?.end ?? "");
  const after = parseRecipeText(text);
  return shape(after) === shape(before) && after.draft.tags.join() === tags.join() ? { ok: true, text } : { ok: false };
}
