// Ограничение частоты в памяти процесса (контейнер один): отказ — без единого запроса к БД.
// Лимит в Postgres (challenge.ts) остаётся вторым рубежом и переживает перезапуск.
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) sweep(now, windowMs);
  return true;
}

function sweep(now: number, windowMs: number): void {
  for (const [key, times] of hits) if (times.every((at) => now - at >= windowMs)) hits.delete(key);
  // Ключей всё ещё слишком много (атака с тысяч адресов) — сбрасываем: держит лимит в Postgres.
  if (hits.size > MAX_KEYS) hits.clear();
}

/** Ключ адреса для лимита: IPv4 как есть, IPv6 — сеть /64 (иначе один провайдерский блок обходит лимит). */
export function ipKey(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (v4?.[1]) return v4[1];
  if (!ip.includes(":")) return ip || "unknown";
  const [head = "", tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups
    .slice(0, 4)
    .map((group) => (parseInt(group, 16) || 0).toString(16))
    .join(":")}::/64`;
}
