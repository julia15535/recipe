import { type Issue, issue } from "./issues";

// Пределы текста рецепта (план recipe-upload): защищают разбор, Server Action и БД (CHECK source_text).
export const LIMITS = {
  bytes: 20_480,
  lines: 300,
  // Шаг часто пишут одним абзацем — строка может быть длинной, как шаг.
  lineLength: 2000,
  title: 120,
  ingredients: 60,
  steps: 40,
  step: 2000,
  name: 200,
  note: 300,
  unit: 30,
} as const;

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Размер считается в байтах UTF-8 — как в БД (`octet_length`). */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function checkLimits(text: string): Issue[] {
  if (text.trim() === "") return [issue("text-empty")];
  if (byteLength(text) > LIMITS.bytes) return [issue("text-too-large")];
  const lines = text.split(/\r?\n/);
  if (lines.length > LIMITS.lines) return [issue("too-many-lines")];
  return lines.flatMap((line, index) => {
    if (line.length > LIMITS.lineLength) return [issue("line-too-long", index + 1, line.slice(0, 80))];
    if (CONTROL.test(line)) return [issue("control-chars", index + 1, line.slice(0, 80))];
    return [];
  });
}
