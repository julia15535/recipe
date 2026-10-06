// Текст статьи → строки и метки фото. Метка — только целой строкой: «[Фото Q7K2]» (код постоянный, номер в
// предпросмотре — только для глаз: при перестановке меток фото не путаются, критика Codex 04.10).
import type { ArticleIssue } from "./types";

export const ARTICLE_LIMITS = {
  bytes: 20_480,
  lines: 300,
  blocks: 100,
  photos: 10,
  title: 120,
  heading: 160,
  text: 2000,
} as const;

const MARKER = /^\s*\[\s*фото\s+([a-z0-9]{4})\s*\]\s*$/iu;
const MARKER_LIKE = /\[\s*фото/iu;
// Без похожих символов (0/O, 1/I): код метки владелец может перепечатать.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ArticleLines = {
  lines: string[];
  /** Номер строки → код фото. */
  markers: Map<number, string>;
  issues: ArticleIssue[];
};

/** Перевод строк — LF, Unicode NFC (не NFKC: он меняет авторские символы), без пробелов в конце строк. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+$/u, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

export const byteLength = (text: string): number => new TextEncoder().encode(text).length;
export const isBlank = (line: string): boolean => line.trim() === "";
export const markerLine = (key: string): string => `[Фото ${key}]`;

export function readLines(text: string): ArticleLines {
  const issues: ArticleIssue[] = [];
  const decide = (message: string) => issues.push({ group: "decide", text: message });
  if (text.trim() === "") decide("Текст пустой — вставьте статью.");
  if (byteLength(text) > ARTICLE_LIMITS.bytes) decide("Текст длиннее 20 КБ — сократите статью.");
  const lines = text.split("\n");
  if (lines.length > ARTICLE_LIMITS.lines) decide(`В тексте больше ${ARTICLE_LIMITS.lines} строк — сократите статью.`);
  const markers = new Map<number, string>();
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const match = MARKER.exec(line);
    if (match) {
      const key = (match[1] ?? "").toUpperCase();
      if (seen.has(key)) decide(`Метка «${markerLine(key)}» стоит дважды — оставьте одну.`);
      seen.add(key);
      markers.set(index, key);
    } else if (MARKER_LIKE.test(line)) {
      decide(`Метка фото должна стоять отдельной строкой: «${line.trim().slice(0, 80)}».`);
    }
  });
  if (seen.size > ARTICLE_LIMITS.photos) decide(`Фото больше ${ARTICLE_LIMITS.photos} — уберите лишние метки.`);
  return { lines, markers, issues };
}

/** Строки с текстом (не пустые и не метки) — их и размечает ИИ. */
export function contentLines({ lines, markers }: Pick<ArticleLines, "lines" | "markers">): number[] {
  return lines.flatMap((line, index) => (isBlank(line) || markers.has(index) ? [] : [index]));
}

/** Новый код фото, которого ещё нет у статьи. `random` — для тестов. */
export function newPhotoKey(taken: ReadonlySet<string>, random: () => number = Math.random): string {
  for (;;) {
    const key = Array.from({ length: 4 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "A").join("");
    if (!taken.has(key)) return key;
  }
}
