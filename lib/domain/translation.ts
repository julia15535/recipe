// Перевод рецепта (ADR-0029). ИИ получает только тексты, а числа в них — метками ⟦1⟧, ⟦2⟧…: температуру, граммы и
// минуты он поменять не может, а пропавшая или лишняя метка — отказ перевода. Количества, единицы, разделы, теги и
// основной ингредиент копирует код из снимка русского рецепта, не ИИ.
import { type Masked, unmaskNumbers } from "./translation-numbers";
import { type AiTranslation, type ComposeResult, type SourceRecipe, TRANSLATION_SCHEMA_VERSION, type TranslationBody, type TranslationHead } from "./translation-types";
import { isCanonicalUnit } from "./units";

export * from "./translation-types";

// Пределы — как у русского рецепта в БД (название до 120) и в снимке: числа после подстановки длиннее меток.
const MAX = { title: 120, description: 1000, time: 100, name: 200, note: 300, step: 2000, tip: 1000 } as const;
type Pair = [string, string];
const pairOf = (forms: readonly [string, string] | null | undefined): Pair | null => {
  const pair = forms && ([forms[0].trim(), forms[1].trim()] as Pair);
  return pair && pair[0] && pair[1] ? pair : null;
};

/**
 * Ответ ИИ + снимок русского → перевод. Тексты в ответе — с метками; `masks` — поле по пути (`title`,
 * `ingredients.<id>.name`, `steps.<id>` …) с метками и числами. Порядок и id строк, наличие описания, времени, выхода
 * и форм авторской единицы должны совпасть с русским.
 */
export function composeTranslation(source: SourceRecipe, ai: AiTranslation, masks: ReadonlyMap<string, Masked>): ComposeResult {
  const sameIds = (a: readonly { id: string }[], b: readonly { id: string }[]) => a.length === b.length && a.every((row, i) => row.id === b[i]?.id);
  if (!sameIds(source.ingredients, ai.ingredients) || !sameIds(source.steps, ai.steps) || !sameIds(source.tips, ai.tips)) return fail("structure");
  const same = (a: unknown, b: unknown) => (a === null) === (b === null);
  if (!same(source.yield, ai.yieldForms) || !same(source.description, ai.description) || !same(source.time, ai.time)) return fail("structure");
  const yieldForms = pairOf(ai.yieldForms);
  if (source.yield && !yieldForms) return fail("structure");
  let broken: "structure" | "numbers" | null = null;
  const back = (path: string, text: string | null, max: number): string | null => {
    if (text === null) return null;
    const mask = masks.get(path);
    const value = unmaskNumbers(text.trim(), mask?.numbers ?? [], "en", mask?.text);
    if (value === null) broken ??= "numbers";
    else if (value === "" || value.length > max) broken ??= "structure";
    return value ?? "";
  };
  const ingredients = source.ingredients.map((row, i) => {
    const out = ai.ingredients[i];
    // Авторская единица («горсть») — английские формы обязательны, иначе на /en останется русское слово.
    const custom = row.unit !== null && !isCanonicalUnit(row.unit);
    const unitForms = custom ? pairOf(out?.unitForms) : null;
    if (custom && !unitForms) broken ??= "structure";
    return {
      id: row.id,
      quantity: row.quantity,
      unit: row.unit,
      kind: row.kind,
      ...(row.amountStyle ? { amountStyle: row.amountStyle } : {}),
      name: back(`ingredients.${row.id}.name`, out?.name ?? "", MAX.name) ?? "",
      note: row.note === null ? null : back(`ingredients.${row.id}.note`, out?.note ?? "", MAX.note),
      unitForms,
    };
  });
  const head: TranslationHead = {
    title: back("title", ai.title, MAX.title) ?? "",
    description: back("description", ai.description, MAX.description),
    time: back("time", ai.time, MAX.time),
    yieldForms,
  };
  const body: TranslationBody = {
    schemaVersion: TRANSLATION_SCHEMA_VERSION,
    yield: source.yield?.amount ?? null,
    sectionCodes: source.sectionCodes,
    primarySectionCode: source.primarySectionCode,
    tagCodes: source.tagCodes,
    mainId: source.mainId,
    ingredients,
    steps: source.steps.map((row, i) => ({ id: row.id, text: back(`steps.${row.id}`, ai.steps[i]?.text ?? "", MAX.step) ?? "" })),
    tips: source.tips.map((row, i) => ({ id: row.id, text: back(`tips.${row.id}`, ai.tips[i]?.text ?? "", MAX.tip) ?? "" })),
  };
  return broken ? fail(broken) : { ok: true, head, body };
}

const fail = (reason: "structure" | "numbers"): ComposeResult => ({ ok: false, reason });
