// Строки «ключ: значение» из шапки: теги/разделы, описание, время, выход.
import { type SectionCode, type TagCode, recognizeCatalogWord } from "../catalog";
import { type Fraction, parseNumber } from "../fraction";
import { SERVINGS, type WordForms } from "../rescale";
import type { KeyLine } from "./blocks";
import { type Issue, issue } from "./issues";

export type Meta = {
  title: string | null;
  titleLine: number | null;
  description: string | null;
  time: string | null;
  yield: { amount: Fraction; forms: WordForms } | null;
  sections: SectionCode[];
  tags: TagCode[];
};

const PIECES = ["штука", "штуки", "штук"] as const;

export function readMeta(keys: KeyLine[], issues: Issue[]): Meta {
  const meta: Meta = { title: null, titleLine: null, description: null, time: null, yield: null, sections: [], tags: [] };
  for (const { key, value, line } of keys) {
    if (!value) continue;
    if (key === "название" || key === "рецепт") [meta.title, meta.titleLine] = [value, line.n];
    else if (key === "описание") meta.description = value;
    else if (key.startsWith("время")) meta.time = value.slice(0, 60);
    else if (key === "выход" || key.startsWith("порци")) meta.yield = readYield(value, line.n, line.text, issues);
    else readCatalog(value, line.n, line.text, meta, issues);
  }
  return meta;
}

function readCatalog(value: string, n: number, raw: string, meta: Meta, issues: Issue[]): void {
  for (const word of value.split(/[,;]/).map((part) => part.trim()).filter(Boolean)) {
    const found = recognizeCatalogWord(word);
    if (found?.kind === "section" && !meta.sections.includes(found.code)) meta.sections.push(found.code);
    else if (found?.kind === "tag" && !meta.tags.includes(found.code)) meta.tags.push(found.code);
    else if (!found) issues.push(issue("unknown-tag", n, raw, word));
  }
}

function readYield(value: string, n: number, raw: string, issues: Issue[]): Meta["yield"] {
  const match = /^~?\s*(\d{1,4}(?:[.,]\d{1,2})?|\d{0,3}\s?[½⅓¼¾⅔])\s*(.*)$/.exec(value.trim());
  const amount = match?.[1] ? parseNumber(match[1]) : null;
  if (!amount || amount.num === 0) {
    issues.push(issue("yield-unparsed", n, raw));
    return null;
  }
  const word = (match?.[2] ?? "").replace(/[.,;]+$/, "").trim().toLowerCase();
  if (word === "" || word.startsWith("порц")) return { amount, forms: SERVINGS };
  if (/^шт/.test(word)) return { amount, forms: PIECES };
  issues.push(issue("yield-word", n, raw, word));
  return { amount, forms: [word, word, word] };
}
