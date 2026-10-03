import { parseAiEnv, parseAuthEnv, parseServerEnv, parseSiteConfig } from "./lib/server/env-schema";
import { createJobsSecret } from "./lib/server/jobs-secret";

// Без обязательных переменных прод-процесс завершается сразу и с понятной причиной, а не падает
// позже на первом запросе. Во время `next build` не проверяем — секретов там нет.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  try {
    parseSiteConfig(process.env, "production");
    parseServerEnv(process.env, "production");
    // Вход владельца необязателен, но заданный наполовину или с ошибкой — повод не стартовать.
    parseAuthEnv(process.env);
    parseAiEnv(process.env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: message })}\n`);
    process.exit(1);
  }
}

// Подборщик переводов (ADR-0029): раз в минуту процесс зовёт сам себя — перевод, прерванный перезапуском, и
// недосброшенный кэш доделываются без таймеров на сервере. Только в проде, одна регистрация, тики не перекрываются.
const TICKER = Symbol.for("recipe.translationTicker");
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && !(globalThis as Record<symbol, unknown>)[TICKER]) {
  const secret = createJobsSecret();
  const url = `http://127.0.0.1:${process.env.PORT ?? "3000"}/api/jobs/translations`;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await fetch(url, { method: "POST", headers: { "x-jobs-secret": secret }, signal: AbortSignal.timeout(170_000), cache: "no-store" });
    } catch {
      // Сервер ещё не слушает порт или перевод долгий — следующий тик.
    } finally {
      busy = false;
    }
  };
  (globalThis as Record<symbol, unknown>)[TICKER] = setInterval(() => void tick(), 60_000).unref();
  // Первый подбор — вскоре после старта (перевод, прерванный деплоем); сервер ещё может не слушать порт — тогда
  // через минуту.
  setTimeout(() => void tick(), 5_000).unref();
}
