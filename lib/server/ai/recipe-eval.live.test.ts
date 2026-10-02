// Ручная проверка промпта на НАСТОЯЩЕЙ модели (платно, ~$0.001 за текст): не в CI.
// Запуск: RECIPE_AI_EVAL=1 AI_GATEWAY_API_KEY=… pnpm vitest run lib/server/ai/recipe-eval.live
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseAiEnv } from "@/lib/server/env-schema";

import { parseWithAi } from "./parse-recipe";

const enabled = process.env.RECIPE_AI_EVAL === "1";
const dir = path.join(process.cwd(), "scripts/ai-eval");
const labels = { sections: new Map<string, string>(), tags: new Map<string, string>() };
const digits = (text: string) => new Set(text.match(/\d+/g) ?? []);

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
    // Числа рецепта не выдумываются: каждое число из шагов есть в исходном тексте.
    const source = digits(text);
    const invented = draft.steps.flatMap((step) => [...digits(step)].filter((d) => !source.has(d)));
    process.stdout.write(
      `\n=== ${file} ok=${ok} title=«${draft.title}» sections=${draft.sections} tags=${draft.tags} ingredients=${draft.ingredients.length} steps=${draft.steps.length} tips=${draft.tips.length}\n` +
        draft.ingredients.map((item) => `  - ${item.name} | ${JSON.stringify(item.quantity)} ${item.unit ?? ""} | ${item.note ?? ""}${item.main ? " | ОСНОВНОЙ" : ""}`).join("\n") +
        `\n${draft.steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n")}\n  tips: ${draft.tips.join(" / ")}\n` +
        checks.map((check) => `  [${check.group}] ${check.text}`).join("\n") +
        `\n  выдуманные числа в шагах: ${invented.join(",") || "нет"}\n`,
    );
    expect(invented).toEqual([]);
  }, 120_000);
});
