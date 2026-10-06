// Ручная проверка подбора тегов на НАСТОЯЩЕЙ модели (платно, ~$0.0005 за текст): не в CI.
// Запуск: RECIPE_AI_EVAL=1 AI_GATEWAY_API_KEY=… pnpm vitest run lib/server/ai/suggest-tags.live
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { withoutCatalogLines } from "@/lib/domain/recipe-text/retag";
import { parseAiEnv } from "@/lib/server/env-schema";

import { NEW_TAGS_MAY_BE, NOT_SWEET } from "./recipe-eval.expected";
import { suggestTagsWithAi } from "./suggest-tags";

const enabled = process.env.RECIPE_AI_EVAL === "1";
const dir = path.join(process.cwd(), "scripts/ai-eval");
// Те же примеры, что у разбора, — без строк каталога (как кнопка). Овсянка (21): «омега-3, антиоксиданты» были только
// в строке автора — без неё новых тегов нет.
const MUST: Record<string, string[]> = { "17-losos-omega.txt": ["omega-3"], "18-smuzi-chernika.txt": ["antioxidants"] };
const NEVER: Record<string, string[]> = { "21-avtor-nazval-tegi.txt": ["omega-3", "antioxidants"] };

describe.skipIf(!enabled)("подбор тегов на настоящей модели", () => {
  const files = enabled ? readdirSync(dir).filter((name) => name.endsWith(".txt")) : [];
  it.each(files)("%s", async (file) => {
    const config = parseAiEnv(process.env);
    if (!config) throw new Error("нет AI_GATEWAY_API_KEY");
    const answer = await suggestTagsWithAi(withoutCatalogLines(readFileSync(path.join(dir, file), "utf8")), config);
    expect(answer.ok, JSON.stringify(answer)).toBe(true);
    if (!answer.ok) return;
    process.stdout.write(`\n=== ${file} tags=${answer.tags}\n`);
    for (const [code, allowed] of Object.entries(NEW_TAGS_MAY_BE)) if (!allowed.includes(file)) expect(answer.tags, code).not.toContain(code);
    if (NOT_SWEET.includes(file)) expect(answer.tags, "low-sugar").not.toContain("low-sugar");
    for (const code of MUST[file] ?? []) expect(answer.tags).toContain(code);
    for (const code of NEVER[file] ?? []) expect(answer.tags).not.toContain(code);
  }, 60_000);
});
