import "server-only";

import { guarded as guardedIn } from "@/lib/server/db/errors";

// Ошибки БД входа — без параметров запроса (хеши токенов) в тексте; общий механизм — lib/server/db/errors.ts.
export const guarded = <T>(work: () => Promise<T>): Promise<T> => guardedIn("вход владельца", work);
