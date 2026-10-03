// Секрет процесса для внутреннего вызова подборщика (ADR-0029): создаётся при старте сервера в instrumentation-node.ts
// и живёт только в памяти этого процесса (standalone-сервер Next — один процесс, `globalThis` общий). Без него
// (сборка, dev) подборщик не работает. Без `server-only`: файл подключает и instrumentation.
const KEY = Symbol.for("recipe.jobsSecret");
type Holder = { [KEY]?: string };

export function jobsSecret(): string | null {
  return (globalThis as Holder)[KEY] ?? null;
}

export function createJobsSecret(): string {
  const holder = globalThis as Holder;
  holder[KEY] ??= crypto.randomUUID() + crypto.randomUUID();
  return holder[KEY];
}
