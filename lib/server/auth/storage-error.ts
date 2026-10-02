import "server-only";

/**
 * Ошибка БД входа без текста запроса: сообщение ошибки Drizzle содержит параметры (хеши токенов,
 * привязки, вызова), а Next пишет необработанные ошибки в лог. Наружу — только код Postgres.
 */
export class AuthStorageError extends Error {
  override name = "AuthStorageError";
  constructor(readonly code: string | undefined) {
    super(`вход владельца: ошибка БД${code ? ` (${code})` : ""}`);
  }
}

function pgCode(error: unknown): string | undefined {
  const cause = error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
  return typeof cause?.code === "string" ? cause.code : undefined;
}

export async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new AuthStorageError(pgCode(error));
  }
}
