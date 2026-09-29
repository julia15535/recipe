// Проверка env при старте прод-сервера (ADR-0011). Node-код — в отдельном модуле: этот файл
// компилируется и для Edge, где process.exit недоступен.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
