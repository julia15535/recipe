// Разбор текста рецепта «как пишет владелец» (план recipe-upload, без ИИ — ADR-0008). Всегда отдаёт
// черновик — что понято — и замечания; сохранять можно только без ошибок (`ok`).
import type { SectionCode, TagCode } from "../catalog";
import type { Fraction } from "../fraction";
import type { WordForms } from "../rescale";
import { type Blocks, type Line, splitBlocks } from "./blocks";
import { type IngredientLine, parseIngredientLine } from "./ingredient-line";
import { type Issue, issue } from "./issues";
import { LIMITS, checkLimits } from "./limits";
import { readMeta } from "./meta";

export type ParsedIngredient = IngredientLine & { line: number; raw: string };
export type RecipeDraft = {
  title: string;
  description: string | null;
  time: string | null;
  yield: { amount: Fraction; forms: WordForms } | null;
  sections: SectionCode[];
  tags: TagCode[];
  ingredients: ParsedIngredient[];
  steps: string[];
  tips: string[];
};
export type ParseResult = { ok: boolean; draft: RecipeDraft; mainIndex: number | null; issues: Issue[] };

const EMPTY: RecipeDraft = { title: "", description: null, time: null, yield: null, sections: [], tags: [], ingredients: [], steps: [], tips: [] };

export function parseRecipeText(text: string): ParseResult {
  const issues = checkLimits(text);
  if (issues.some((item) => item.line === null)) return { ok: false, draft: EMPTY, mainIndex: null, issues };
  const blocks = splitBlocks(text);
  const { titleLine, ...meta } = readMeta(blocks.keys, issues);
  const title = meta.title ?? cleanTitle(blocks.title?.text ?? "");
  if (!title) issues.push(issue("no-title"));
  else if (title.length > LIMITS.title) issues.push(issue("title-too-long", titleLine ?? blocks.title?.n ?? null, title.slice(0, 80)));
  // Есть «Название:» — первая свободная строка шапки не теряется, а идёт в описание.
  const free = meta.title && blocks.title ? [blocks.title, ...blocks.description] : blocks.description;
  if (meta.sections.length === 0) issues.push(issue("no-section"));

  const ingredients = readIngredients(blocks.ingredients, issues);
  const mainIndex = findMain(ingredients, issues);
  const steps = readSteps(blocks.steps, issues);
  const tips = blocks.tips.map((line) => line.text.replace(STEP_MARKER, "").trim()).filter(Boolean);
  if (tips.length > LIMITS.tips) issues.push(issue("too-many-tips"));
  for (const line of blocks.tips) if (line.text.length > LIMITS.tip) issues.push(issue("tip-too-long", line.n, line.text.slice(0, 80)));

  const description = [meta.description ?? "", ...free.map((line) => line.text)].filter(Boolean).join(" ") || null;
  const draft: RecipeDraft = { ...meta, title, description, ingredients, steps, tips };
  return { ok: !issues.some((item) => item.severity === "error"), draft, mainIndex, issues: sortIssues(issues) };
}

/** «Рецепт Творожные вафли» → «Творожные вафли»; «Рецепт вафель из творога» — как есть. */
function cleanTitle(text: string): string {
  return text.replace(/^[Рр]ецепт\s+(?=\p{Lu})/u, "").trim();
}

function readIngredients(lines: Blocks["ingredients"], issues: Issue[]): ParsedIngredient[] {
  if (lines.length === 0) issues.push(issue("no-ingredients"));
  if (lines.length > LIMITS.ingredients) issues.push(issue("too-many-ingredients"));
  return lines.flatMap((line) => {
    const result = parseIngredientLine(line.text);
    if (!result.ok) {
      issues.push(issue(result.code, line.n, line.text, result.name));
      return [];
    }
    const { name, note, unit } = result.value;
    if (name.length > LIMITS.name || (note?.length ?? 0) > LIMITS.note || (unit?.length ?? 0) > LIMITS.unit) {
      issues.push(issue("ingredient-too-long", line.n, line.text.slice(0, 80)));
      return [];
    }
    if (result.unknownUnit) issues.push(issue("unknown-unit", line.n, line.text, result.unknownUnit));
    return [{ ...result.value, line: line.n, raw: line.text }];
  });
}

function findMain(ingredients: ParsedIngredient[], issues: Issue[]): number | null {
  const marked = ingredients.flatMap((item, index) => (item.main ? [index] : []));
  if (marked.length === 0) {
    const candidate = ingredients.find((item) => item.quantity.kind === "exact");
    if (ingredients.length) issues.push(issue("no-main", candidate?.line ?? null, candidate?.raw ?? null, candidate?.name ?? ""));
    return null;
  }
  for (const index of marked.slice(1)) issues.push(issue("many-main", ingredients[index]?.line ?? null, ingredients[index]?.raw ?? null));
  const main = ingredients[marked[0] ?? 0];
  if (main && main.quantity.kind !== "exact") issues.push(issue("main-not-exact", main.line, main.raw));
  return marked.length === 1 && main?.quantity.kind === "exact" ? (marked[0] ?? null) : null;
}

// Номер шага: «1.», «1)», «1:», «1 — » (так пишет владелец, 02.10), «Шаг 1», «1.Творог», маркеры списка.
const STEP_MARKER = /^\s*(?:(?:шаг\s*)?\d{1,2}\s*(?:[.):](?=\s|\p{L})|[—–-]\s)|шаг\s*\d{1,2}(?=\s)|[●•▪◦∙·*]|[-–—](?=\s))\s*/iu;
// Несколько шагов в одной строке: «1. Творог разомни. 2. Добавь яйца.» — делим перед «N. Заглавная»
// или «N — Заглавная»; «на 7–8 минут» не делится (после числа — не заглавная).
const INLINE_STEP = /\s+(?=\d{1,2}\s*(?:[.)]|[—–-]\s)\s*\p{Lu})/u;
// Строка — продолжение шага, только если шаг оборван (без точки в конце) и строка с маленькой буквы
// (так переносит строки PDF); иначе это новый шаг, даже без номера.
const CONTINUES = (previous: string, text: string) => !/[.!?…:;)»"]$/.test(previous) && /^\p{Ll}/u.test(text);

function readSteps(lines: Line[], issues: Issue[]): string[] {
  const steps: string[] = [];
  for (const line of lines) {
    for (const part of line.text.split(INLINE_STEP)) {
      const marked = STEP_MARKER.test(part);
      const text = part.replace(STEP_MARKER, "").trim();
      if (!text) continue; // строка из одного маркера — пустой шаг не создаём
      const previous = steps.at(-1);
      if (!marked && previous !== undefined && CONTINUES(previous, text)) {
        steps[steps.length - 1] = `${previous} ${text}`;
        issues.push(issue("step-joined", line.n, line.text));
      } else steps.push(text);
    }
  }
  if (steps.length === 0) issues.push(issue("no-steps"));
  if (steps.length > LIMITS.steps) issues.push(issue("too-many-steps"));
  if (steps.some((step) => step.length > LIMITS.step)) issues.push(issue("step-too-long"));
  return steps;
}

const sortIssues = (issues: Issue[]) =>
  [...issues].sort((a, b) => (a.severity === b.severity ? (a.line ?? 0) - (b.line ?? 0) : a.severity === "error" ? -1 : 1));
