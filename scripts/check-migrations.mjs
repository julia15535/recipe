// Проверка журнала миграций Drizzle (ADR-0012, CI job check):
// - у каждой записи журнала есть SQL-файл;
// - время записей строго растёт по порядку (миграция «назад во времени» может быть пропущена
//   мигратором Drizzle, который смотрит на последний created_at);
// - в drizzle/ нет SQL-файлов вне журнала.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(path.join(dir, "meta", "_journal.json"), "utf8"));
const errors = [];
let previous = -Infinity;

for (const entry of journal.entries) {
  const file = `${entry.tag}.sql`;
  if (!readdirSync(dir).includes(file)) errors.push(`нет файла ${file} для записи журнала idx=${entry.idx}`);
  if (!(entry.when > previous)) errors.push(`миграция ${entry.tag} «назад во времени»: when=${entry.when} ≤ ${previous}`);
  previous = entry.when;
}

const known = new Set(journal.entries.map((entry) => `${entry.tag}.sql`));
for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql"))) {
  if (!known.has(file)) errors.push(`файл ${file} не записан в журнал`);
}

if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}
console.log(`✓ журнал миграций в порядке (${journal.entries.length})`);
