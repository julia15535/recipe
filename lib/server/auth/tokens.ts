// Случайные значения входа и их хеши. Без server-only: модуль чистый, его читают и юнит-тесты.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { ipKey } from "./rate-limit";

/** 256 бит в base64url — 43 символа; годится и для `?start=` у Telegram (A–Z, a–z, 0–9, _ и -). */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** Четыре цифры, которые владелец сверяет глазами на экране и в сообщении бота. */
export function newDisplayCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

/** Сравнение секретов за постоянное время (длины выравниваем хешированием). */
export function secretsEqual(given: string | null, expected: string): boolean {
  if (given === null) return false;
  return timingSafeEqual(hashToken(given), hashToken(expected));
}

/** Адрес клиента: X-Real-IP от nginx-proxy, иначе последний X-Forwarded-For; IPv6 — сеть /64. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return ipKey(headers.get("x-real-ip")?.trim() || forwarded || "unknown");
}

/** Псевдоним IP для ограничения частоты: сам адрес в БД не попадает. */
export function ipHash(headers: Headers, key: string): Buffer {
  return createHmac("sha256", key).update(clientIp(headers)).digest();
}
