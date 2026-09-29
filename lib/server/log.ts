import "server-only";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

// Ключи, значения которых никогда не пишем в лог (телефон, токены, текст импорта рецепта).
const SECRET_KEY = /(pass(word)?|secret|token|authorization|cookie|api[-_]?key|session)/i;
const PHONE_KEY = /phone/i;
const TEXT_KEY = /^(text|importText|transcript|rawText)$/;
const PHONE_IN_TEXT = /\+?\d[\d\s()-]{8,}\d/g;
const MAX_DEPTH = 5;

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length < 4 ? "***" : `***${digits.slice(-2)}`;
}

/** Маскирует секреты рекурсивно. Экспортирована для тестов. */
export function redact(value: unknown, key = "", depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[depth]";
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (PHONE_KEY.test(key)) return maskPhone(value);
    if (TEXT_KEY.test(key)) return `[text len=${value.length}]`;
    return value.replace(PHONE_IN_TEXT, maskPhone);
  }
  if (value instanceof Error) return { name: value.name, message: redact(value.message, "", depth + 1) };
  if (Array.isArray(value)) return value.map((item) => redact(item, "", depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k, depth + 1)]));
  }
  return value;
}

function write(level: Level, msg: string, fields: Fields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    version: process.env.GIT_SHA ?? "dev",
    ...(redact(fields) as Fields),
  });
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const log = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
