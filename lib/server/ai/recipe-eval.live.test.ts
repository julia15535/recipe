// Ручная проверка промпта на НАСТОЯЩЕЙ модели (платно, ~$0.001 за текст): не в CI.
// Запуск: RECIPE_AI_EVAL=1 AI_GATEWAY_API_KEY=… pnpm vitest run lib/server/ai/recipe-eval.live
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NO_LIST } from "@/lib/domain/recipe-text/ai-checks";
import type { ParsedIngredient } from "@/lib/domain/recipe-text/parse";
import { parseAiEnv } from "@/lib/server/env-schema";

import { parseWithAi } from "./parse-recipe";
import { EXPECTED } from "./recipe-eval.expected";

const enabled = process.env.RECIPE_AI_EVAL === "1";
const dir = path.join(process.cwd(), "scripts/ai-eval");
const labels = { sections: new Map<string, string>(), tags: new Map<string, string>() };
const digits = (text: string) => new Set(text.match(/\d+/g) ?? []);
const plain = (text: string) => text.toLowerCase().replaceAll("ё", "е");

const amountOf = ({ quantity: q }: ParsedIngredient) => {
  const show = (f: { num: number; den: number }) => (f.den === 1 ? `${f.num}` : `${f.num}/${f.den}`);
  return q.kind === "exact" ? show(q.amount) : q.kind === "range" ? `${show(q.min)}–${show(q.max)}` : "-";
};

/** Строки ингредиентов против ожидаемых «название|количество|единица» (порядок автора, без лишних и пропусков). */
function compareRows(actual: ParsedIngredient[], expected: readonly string[]): string[] {
  const problems: string[] = [];
  let at = 0;
  for (const item of actual) {
    const fits = (spec: string) => spec.replace(/^\?/, "").split("|")[0]?.split("/").some((stem) => plain(item.name).startsWith(stem)) ?? false;
    while (at < expected.length && expected[at]?.startsWith("?") && !fits(expected[at] ?? "")) at += 1;
    const spec = expected[at];
    if (!spec || !fits(spec)) {
      problems.push(`лишняя или не по порядку: «${item.name}»`);
      continue;
    }
    const [, amount, unit] = spec.replace(/^\?/, "").split("|");
    if (amount !== "*" && amountOf(item) !== amount) problems.push(`${item.name}: количество ${amountOf(item)}, ждали ${amount}`);
    if (unit !== "*" && (item.unit ?? "-") !== unit) problems.push(`${item.name}: единица ${item.unit ?? "-"}, ждали ${unit}`);
    at += 1;
  }
  for (const spec of expected.slice(at)) if (!spec.startsWith("?")) problems.push(`нет строки «${spec}»`);
  return problems;
}

describe.skipIf(!enabled)("ИИ-разбор на настоящей модели", () => {
  const files = enabled ? readdirSync(dir).filter((name) => name.endsWith(".txt")) : [];
  it.each(files)("%s", async (file) => {
    const config = parseAiEnv(process.env);
    if (!config) throw new Error("нет AI_GATEWAY_API_KEY");
    const text = readFileSync(path.join(dir, file), "utf8");
    const answer = await parseWithAi(text, config, labels);
    expect(answer.ok, JSON.stringify(answer)).toBe(true);
    if (!answer.ok) return;
    const { draft, checks, ok } = answer.result;
    // Числа рецепта не выдумываются: каждое число из шагов и советов есть в исходном тексте.
    const source = digits(text);
    const invented = [...draft.steps, ...draft.tips].flatMap((step) => [...digits(step)].filter((d) => !source.has(d)));
    const notes = checks.map((check) => check.text);
    process.stdout.write(
      `\n=== ${file} ok=${ok} title=«${draft.title}» sections=${draft.sections} tags=${draft.tags} ingredients=${draft.ingredients.length} steps=${draft.steps.length} tips=${draft.tips.length}\n` +
        draft.ingredients.map((item) => `  - ${item.name} | ${JSON.stringify(item.quantity)} ${item.unit ?? ""} | ${item.note ?? ""}${item.main ? " | ОСНОВНОЙ" : ""}`).join("\n") +
        `\n${draft.steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n")}\n  tips: ${draft.tips.join(" / ")}\n` +
        checks.map((check) => `  [${check.group}] ${check.text}`).join("\n") +
        `\n  выдуманные числа в шагах и советах: ${invented.join(",") || "нет"}\n`,
    );
    expect(invented).toEqual([]);

    const expected = EXPECTED[file];
    if (!expected) throw new Error(`нет ожиданий для ${file} — допишите в recipe-eval.expected.ts`);
    if (expected === "not_recipe") {
      expect(notes.some((note) => note.includes("не похоже на рецепт"))).toBe(true);
      return;
    }
    // Абзац — собрано из текста с замечанием; список — строки ровно из него, без замечания «списка не было».
    expect(notes.includes(NO_LIST)).toBe(expected === "text");
    expect(draft.steps.length).toBeGreaterThan(0);
    if (expected === "text") return;
    expect(compareRows(draft.ingredients, expected.rows)).toEqual([]);
    if (expected.steps !== undefined) expect(draft.steps).toHaveLength(expected.steps);
    if (expected.tips !== undefined) expect(draft.tips).toHaveLength(expected.tips);
    expected.check?.({ steps: draft.steps, tips: draft.tips, notes: notes.map(plain), styles: draft.ingredients.map((item) => item.amountStyle ?? "-") });
  }, 120_000);
});
