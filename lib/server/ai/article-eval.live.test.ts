// Ручная проверка разметки статей на НАСТОЯЩЕЙ модели (платно, доли цента): не в CI.
// Запуск: RECIPE_AI_EVAL=1 AI_GATEWAY_API_KEY=… pnpm vitest run lib/server/ai/article-eval.live
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeText, readLines } from "@/lib/domain/article-text/lines";
import { parseArticle } from "@/lib/domain/article-text/parse";
import { parseAiEnv } from "@/lib/server/env-schema";

import { markupWithAi } from "./article-markup";

const enabled = process.env.RECIPE_AI_EVAL === "1";
const dir = path.join(process.cwd(), "scripts/ai-eval-articles");

// Ожидания: заголовки (по порядку, только h2/h3), списки (нумерованный ли, пунктов), фото, «без пунктов».
type Expected = { headings?: string[]; lists?: [ordered: boolean, items: number][]; photos?: number; noBullets?: boolean; paragraphs?: number };
const EXPECTED: Record<string, Expected> = {
  "01-instagram.txt": {},
  "02-zametka-spiski.txt": { headings: ["Что взять для подачи", "Как собрать"], lists: [[false, 3], [true, 3]] },
  "03-zagolovki.txt": { headings: ["Вафли: три варианта подачи", "С творожным сыром и рыбой", "С ветчиной", "Сладкие"] },
  // Каждая реплика — отдельный абзац, тире на месте.
  "04-dialog.txt": { noBullets: true, paragraphs: 4 },
  "05-metki-foto.txt": { headings: ["С творожным сыром и рыбой", "С ветчиной"], photos: 2 },
  "06-injection.txt": {},
  "07-dlinnaya.txt": {
    headings: ["Как я готовлю завтраки на неделю", "Что готовлю заранее", "Вафли", "Сырники", "Гранола", "Что важно"],
    lists: [[false, 4], [true, 4]],
  },
};

describe.skipIf(!enabled)("разметка статьи на настоящей модели", () => {
  const files = enabled ? readdirSync(dir).filter((name) => name.endsWith(".txt")) : [];
  it.each(files)("%s", async (file) => {
    const config = parseAiEnv(process.env);
    if (!config) throw new Error("нет AI_GATEWAY_API_KEY");
    const text = normalizeText(readFileSync(path.join(dir, file), "utf8"));
    const answer = await markupWithAi(readLines(text), config);
    expect(answer.ok, JSON.stringify(answer)).toBe(true);
    if (!answer.ok) return;
    const parsed = parseArticle(text, answer.marks);
    process.stdout.write(
      `\n=== ${file} byAi=${parsed.byAi}\n` +
        parsed.body.blocks
          .map((block) => (block.type === "list" ? `  list${block.ordered ? " 1." : " •"} ${block.items.map((item) => item.text).join(" | ")}` : block.type === "photo" ? `  [фото ${block.key}]` : `  ${block.type}${block.type === "heading" ? block.level : ""}: ${block.text}`))
          .join("\n") +
        "\n",
    );
    // Разметка ИИ должна лечь на строки сама — без запасного разбора.
    expect(parsed.byAi).toBe(true);
    const expected = EXPECTED[file];
    if (!expected) throw new Error(`нет ожиданий для ${file}`);
    const blocks = parsed.body.blocks;
    if (expected.headings) expect(blocks.flatMap((block) => (block.type === "heading" ? [block.text] : []))).toEqual(expected.headings);
    if (expected.lists) expect(blocks.flatMap((block) => (block.type === "list" ? [[block.ordered, block.items.length]] : []))).toEqual(expected.lists);
    if (expected.photos !== undefined) expect(blocks.filter((block) => block.type === "photo")).toHaveLength(expected.photos);
    if (expected.noBullets) expect(blocks.some((block) => block.type === "list")).toBe(false);
    if (expected.paragraphs !== undefined) expect(blocks.filter((block) => block.type === "paragraph")).toHaveLength(expected.paragraphs);
  }, 120_000);
});
