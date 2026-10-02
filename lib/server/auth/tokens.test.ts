import { describe, expect, it } from "vitest";

import { hashToken, ipHash, newDisplayCode, newToken, secretsEqual, TOKEN_PATTERN } from "./tokens";

describe("токены входа", () => {
  it("новый токен — 256 бит в base64url, каждый раз другой", () => {
    const [a, b] = [newToken(), newToken()];
    expect(a).toMatch(TOKEN_PATTERN);
    expect(a).not.toBe(b);
  });

  it("хеш — 32 байта SHA-256 и не содержит самого токена", () => {
    const token = newToken();
    const hash = hashToken(token);
    expect(hash).toHaveLength(32);
    expect(hash.equals(hashToken(token))).toBe(true);
    expect(hash.toString("base64url")).not.toBe(token);
  });

  it("код для глаз — ровно четыре цифры", () => {
    for (let i = 0; i < 200; i += 1) expect(newDisplayCode()).toMatch(/^\d{4}$/);
  });

  it("секрет webhook: верный — да, чужой, пустой и другой длины — нет", () => {
    const secret = "fake-webhook-secret-for-tests-0000000";
    expect(secretsEqual(secret, secret)).toBe(true);
    expect(secretsEqual(`${secret}x`, secret)).toBe(false);
    expect(secretsEqual("", secret)).toBe(false);
    expect(secretsEqual(null, secret)).toBe(false);
  });

  it("IP берётся из заголовка прокси; последний адрес X-Forwarded-For, а не подставленный клиентом", () => {
    const viaProxy = new Headers({ "x-real-ip": "203.0.113.7" });
    const spoofed = new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });
    expect(ipHash(viaProxy, "k").equals(ipHash(spoofed, "k"))).toBe(true);
    expect(ipHash(viaProxy, "k").equals(ipHash(viaProxy, "other-key"))).toBe(false);
  });
});
