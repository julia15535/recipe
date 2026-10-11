// Ручная проверка перевода статей на НАСТОЯЩЕЙ модели (платно, ~1–3 цента за статью): не в CI.
// Запуск: RECIPE_AI_EVAL=1 AI_GATEWAY_API_KEY=… pnpm vitest run lib/server/ai/article-translate.live
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { byteLength } from "@/lib/domain/recipe-text/limits";
import { normalizeText } from "@/lib/domain/article-text/lines";
import { parseArticle } from "@/lib/domain/article-text/parse";
import { tagSequence, toTagged } from "@/lib/domain/article-text/translation";
import { parseAiEnv } from "@/lib/server/env-schema";
import { translatedArticleSchema } from "@/lib/server/articles/translation-schema";

import { translateArticleWithAi } from "./translate-article";

const enabled = process.env.RECIPE_AI_EVAL === "1";
const dir = path.join(process.cwd(), "scripts/ai-eval-articles");
// Статья у предела 20 КБ: 47 абзацев по ~290 знаков с числами и оформлением — проверка предела ответа и таймаута.
const LONG = Array.from(
  { length: 47 },
  (_, i) =>
    `${i + 1}. **Совет ${i + 1}:** выпекайте при 180 °C примерно ${20 + i} минут, а творог берите *жирностью 5 %*. Если тесто получилось слишком жидким, добавьте ещё ложку муки и дайте ему постоять десять минут — так вафли выйдут хрустящими снаружи и мягкими внутри.`,
).join("\n\n");

describe.skipIf(!enabled)("перевод статьи на настоящей модели", () => {
  const files = enabled ? [...readdirSync(dir).filter((name) => name.endsWith(".txt")), "long"] : [];
  it.each(files)("%s", async (file) => {
    const config = parseAiEnv(process.env);
    if (!config) throw new Error("нет AI_GATEWAY_API_KEY");
    const text = normalizeText(file === "long" ? LONG : readFileSync(path.join(dir, file), "utf8"));
    if (file === "long") expect(byteLength(text)).toBeGreaterThan(19_000);
    const source = { title: "Как подать вафли", body: parseArticle(text, null).body, captions: {} };
    const started = Date.now();
    const answer = await translateArticleWithAi(source, config);
    process.stdout.write(`\n=== ${file} ${Date.now() - started} мс ${answer.ok ? "ok" : answer.reason}\n`);
    expect(answer.ok, JSON.stringify(answer)).toBe(true);
    if (!answer.ok) return;
    expect(translatedArticleSchema.safeParse(answer.article).success).toBe(true);
    for (const [index, block] of source.body.blocks.entries()) {
      const english = answer.article.body.blocks[index];
      expect(english?.type).toBe(block.type);
      if (block.type === "paragraph" && english?.type === "paragraph") {
        expect(tagSequence(toTagged(english.text))).toEqual(tagSequence(toTagged(block.text)));
        process.stdout.write(`  ${english.text.slice(0, 160)}\n`);
      }
    }
  }, 180_000);
});
