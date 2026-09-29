import { parseServerEnv, parseSiteConfig } from "./lib/server/env-schema";

// Без обязательных переменных прод-процесс завершается сразу и с понятной причиной, а не падает
// позже на первом запросе. Во время `next build` не проверяем — секретов там нет.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  try {
    parseSiteConfig(process.env, "production");
    parseServerEnv(process.env, "production");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: message })}\n`);
    process.exit(1);
  }
}
