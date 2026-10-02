import "server-only";

/**
 * Ошибка БД без текста запроса: сообщение ошибки Drizzle содержит параметры (хеши токенов, текст
 * рецепта), а Next пишет необработанные ошибки в лог. Наружу — только код Postgres.
 */
export class StorageError extends Error {
  override name = "StorageError";
  constructor(
    readonly scope: string,
    readonly code: string | undefined,
  ) {
    super(`${scope}: ошибка БД${code ? ` (${code})` : ""}`);
  }
}

type PgLike = { code?: unknown; constraint_name?: unknown };
const pg = (error: unknown): PgLike | undefined =>
  error instanceof Error ? ((error.cause as PgLike | undefined) ?? (error as PgLike)) : undefined;

export function pgCode(error: unknown): string | undefined {
  const code = pg(error)?.code;
  return typeof code === "string" ? code : undefined;
}

/** Нарушение UNIQUE с этим именем ограничения (23505). */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return pgCode(error) === "23505" && pg(error)?.constraint_name === constraint;
}

export async function guarded<T>(scope: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError(scope, pgCode(error));
  }
}
