// Ответ ИИ → черновик рецепта (тот же `RecipeDraft`, что у текстового разбора) + пункты «Проверьте».
// Чистая функция: числа и единицы разбираются нашим кодом, пределы — как у текста и БД.
import { compare, type Fraction, parseNumber } from "../fraction";
import type { Quantity } from "../quantity";
import { SERVINGS, type WordForms } from "../rescale";
import type { AiIngredient, AiRecipe, Check } from "./ai-recipe";
import { LIMITS } from "./limits";
import type { ParsedIngredient, RecipeDraft } from "./parse";
import { readUnit } from "./units";

export type Labels = { sections: ReadonlyMap<string, string>; tags: ReadonlyMap<string, string> };
export type AiDraft = { ok: boolean; draft: RecipeDraft; mainIndex: number | null; checks: Check[] };

const RANGE = /^(.+?)\s*[–—-]\s*(.+)$/;
const NO_AMOUNT_WORD = /^(?:щепотк|щепоть|по вкусу|по желанию|на кончике ножа|для )/i;
// Служебные символы (в т. ч. NUL — Postgres его не примет) убираются, пробелы схлопываются.
const clip = (text: string | null | undefined, max: number) =>
  (text ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const plain = (text: string) => text.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();

export function fromAi(ai: AiRecipe, original: string, labels: Labels): AiDraft {
  const checks: Check[] = [];
  const decide = (text: string) => checks.push({ group: "decide", text });
  if (ai.result_type === "not_recipe") decide("Это не похоже на рецепт — проверьте, тот ли текст вставлен.");

  const title = clip(ai.title, 200);
  if (!title) decide("Нет названия рецепта — допишите его первой строкой.");
  else if (title.length > LIMITS.title) decide("Название длиннее 120 знаков — сократите его.");
  const sections = [...new Set(ai.sections)].slice(0, 3);
  if (sections.length === 0) decide("Не выбран раздел каталога — напишите, например, «раздел: завтраки».");
  const tags = [...new Set(ai.tags)];

  const ingredients = ai.ingredients.slice(0, LIMITS.ingredients).flatMap((item, index) => ingredient(item, index, decide, checks));
  if (ingredients.length === 0) decide("Не нашлось ингредиентов.");
  const mainIndex = findMain(ingredients, decide);

  const steps = ai.steps.map((step) => clip(step, LIMITS.step)).filter(Boolean).slice(0, LIMITS.steps);
  if (steps.length === 0) decide("Не нашлось шагов приготовления.");
  const tips = ai.tips.map((tip) => clip(tip, LIMITS.tip)).filter(Boolean).slice(0, LIMITS.tips);

  const source = plain(original);
  for (const change of ai.changes.slice(0, 20)) {
    const quote = clip(change.quote, 200);
    const found = quote !== "" && source.includes(plain(quote));
    checks.push(
      found
        ? { group: "changed", text: `«${quote}» → ${clip(change.result, 200)}` }
        : { group: "note", text: `ИИ пишет, что изменил «${quote}» → ${clip(change.result, 200)}, но такой фразы в тексте нет — проверьте.` },
    );
  }
  const main = mainIndex === null ? null : ingredients[mainIndex];
  if (main?.quantity.kind === "exact") checks.push({ group: "changed", text: `Основной ингредиент — «${main.name}»: от него пересчитывается рецепт.` });
  const where = [sections.map((code) => labels.sections.get(code) ?? code).join(", "), tags.map((code) => labels.tags.get(code) ?? code).join(", ")];
  if (sections.length) checks.push({ group: "changed", text: `Раздел: ${where[0]}${tags.length ? `; особенности состава: ${where[1]}` : ""}.` });
  for (const doubt of ai.doubts.slice(0, 5)) if (clip(doubt, 300)) checks.push({ group: "note", text: clip(doubt, 300) });

  const yieldValue = yieldOf(ai.yield);
  if (ai.yield && !yieldValue) checks.push({ group: "note", text: `Выход «${clip(ai.yield.amount, 20)} ${clip(ai.yield.word, 30)}» не понят и не показывается.` });
  const draft: RecipeDraft = {
    title: title.slice(0, LIMITS.title),
    description: clip(ai.description, 1000) || null,
    time: clip(ai.time, 60) || null,
    yield: yieldValue,
    sections,
    tags,
    ingredients,
    steps,
    tips,
  };
  return { ok: !checks.some((check) => check.group === "decide"), draft, mainIndex, checks };
}

function ingredient(item: AiIngredient, index: number, decide: (text: string) => void, checks: Check[]): ParsedIngredient[] {
  const name = clip(item.name, LIMITS.name);
  if (!name) return [];
  // «Соль — щепотка»: такое слово без числа — пометка, а не единица.
  const wordOnly = !item.amount && item.unit && NO_AMOUNT_WORD.test(item.unit.trim()) ? clip(item.unit, 30) : "";
  const unit = item.unit && !wordOnly ? readUnit(item.unit) : null;
  const unitText = unit ? (unit.unit ?? null) : null;
  const tail = unit?.extra ? clip(unit.extra, 100) : "";
  // «ст. л. с горкой»: хвост после единицы — пометка, слова автора не теряются.
  const note = clip([wordOnly, tail, item.note].filter(Boolean).join(", "), LIMITS.note) || null;
  if (unit && !unit.known && unitText) checks.push({ group: "note", text: `Единица «${unitText}» у «${name}» оставлена как есть — при пересчёте слово не меняется.` });
  const quantity = item.amount ? quantityOf(item.amount) : ({ kind: "none" } as const);
  if (!quantity) decide(`Не понятно количество у «${name}»: «${clip(item.amount, 40)}» — напишите числом.`);
  else if (quantity.kind === "none" && !note) decide(`У «${name}» нет количества — допишите количество или «по вкусу».`);
  const raw = `${name} — ${item.amount ?? ""} ${unitText ?? ""}`.trim();
  return [{ name, quantity: quantity ?? { kind: "none" }, unit: unitText?.slice(0, LIMITS.unit) ?? null, note, main: item.is_main, line: index + 1, raw }];
}

function quantityOf(amount: string): Quantity | null {
  const text = amount.trim();
  const range = RANGE.exec(text);
  const [min, max] = range ? [parseNumber(range[1] ?? ""), parseNumber(range[2] ?? "")] : [parseNumber(text), null];
  if (!min || min.num === 0 || (range && (!max || compare(min, max) > 0))) return null;
  return max && compare(min, max) !== 0 ? { kind: "range", min, max } : { kind: "exact", amount: min };
}

function findMain(ingredients: ParsedIngredient[], decide: (text: string) => void): number | null {
  const marked = ingredients.flatMap((item, index) => (item.main ? [index] : []));
  if (marked.length !== 1) {
    decide(marked.length ? "Основным отмечено несколько ингредиентов — оставьте один." : "Не выбран основной ингредиент — напишите, от какого считать рецепт.");
    return null;
  }
  const main = ingredients[marked[0] ?? 0];
  if (main?.quantity.kind !== "exact") {
    decide(`У основного ингредиента «${main?.name ?? ""}» нужно точное количество.`);
    return null;
  }
  return marked[0] ?? null;
}

function yieldOf(value: AiRecipe["yield"]): { amount: Fraction; forms: WordForms } | null {
  const amount = value ? parseNumber(value.amount) : null;
  if (!value || !amount || amount.num === 0) return null;
  const word = clip(value.word, 30).toLowerCase();
  if (word === "" || word.startsWith("порц")) return { amount, forms: SERVINGS };
  if (word.startsWith("шт")) return { amount, forms: ["штука", "штуки", "штук"] };
  return { amount, forms: [word, word, word] };
}

/** Перед сохранением: разбор с сервера ещё раз проверяется на то, без чего БД его не примет. */
export function isSavable({ ok, draft, mainIndex }: AiDraft): boolean {
  const main = mainIndex === null ? undefined : draft.ingredients[mainIndex];
  return (
    ok &&
    main?.quantity.kind === "exact" &&
    draft.title.length > 0 &&
    draft.title.length <= LIMITS.title &&
    draft.sections.length > 0 &&
    draft.ingredients.length > 0 &&
    draft.ingredients.length <= LIMITS.ingredients &&
    draft.ingredients.every((item) => item.quantity.kind !== "none" || Boolean(item.note)) &&
    draft.steps.length > 0 &&
    draft.steps.length <= LIMITS.steps &&
    draft.steps.every((step) => step.length > 0 && step.length <= LIMITS.step) &&
    draft.tips.every((tip) => tip.length <= LIMITS.tip)
  );
}
