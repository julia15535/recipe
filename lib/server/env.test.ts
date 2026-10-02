import { describe, expect, it } from "vitest";

import { parseAuthEnv, parseServerEnv, parseSiteConfig } from "./env-schema";

describe("parseSiteConfig", () => {
  it("в разработке подставляет локальный адрес и не индексирует", () => {
    expect(parseSiteConfig({}, "development")).toEqual({ siteUrl: "http://localhost:3010", indexable: false });
  });

  it("в production без SITE_URL падает с понятной ошибкой", () => {
    expect(() => parseSiteConfig({}, "production")).toThrow(/SITE_URL/);
  });

  it("срезает завершающий слэш и включает индексацию только явным true", () => {
    const config = parseSiteConfig({ SITE_URL: "https://mycoruja.food/", SITE_INDEXABLE: "true" }, "production");
    expect(config).toEqual({ siteUrl: "https://mycoruja.food", indexable: true });
  });

  it("отвергает мусор в SITE_INDEXABLE", () => {
    expect(() => parseSiteConfig({ SITE_URL: "https://mycoruja.food", SITE_INDEXABLE: "yes" }, "production")).toThrow(
      /SITE_INDEXABLE/,
    );
  });
});

describe("parseServerEnv", () => {
  it("в разработке берёт локальную базу", () => {
    expect(parseServerEnv({}, "development").DATABASE_URL).toContain("127.0.0.1:5434");
  });

  it("в production без DATABASE_URL и GIT_SHA падает, называя обе переменные", () => {
    expect(() => parseServerEnv({}, "production")).toThrow(/DATABASE_URL.*GIT_SHA/);
  });

  it("не дописывает дефолты в production, даже если часть переменных есть", () => {
    expect(() => parseServerEnv({ DATABASE_URL: "postgres://app@db:5432/recipe" }, "production")).toThrow(/GIT_SHA/);
  });
});

describe("parseAuthEnv", () => {
  const valid = {
    TELEGRAM_BOT_TOKEN: "123456:fake-token-for-tests-only-aaaaaaaaaa",
    TELEGRAM_BOT_USERNAME: "test_recipes_bot",
    TELEGRAM_WEBHOOK_SECRET: "fake-webhook-secret-for-tests-0000000",
    OWNER_TELEGRAM_ID: "4503599627370495",
  };

  it("без переменных вход выключен, а не ошибка", () => {
    expect(parseAuthEnv({})).toBeNull();
  });

  it("id владельца — bigint (предел Telegram 2^52); адрес Bot API по умолчанию — Telegram", () => {
    const config = parseAuthEnv(valid);
    expect(config?.ownerTelegramId).toBe(4503599627370495n);
    expect(() => parseAuthEnv({ ...valid, OWNER_TELEGRAM_ID: "4503599627370496" })).toThrow(/OWNER_TELEGRAM_ID/);
    expect(config?.apiBase).toBe("https://api.telegram.org");
  });

  it("часть переменных — ошибка с именами, без значений", () => {
    const run = () => parseAuthEnv({ TELEGRAM_BOT_TOKEN: valid.TELEGRAM_BOT_TOKEN });
    expect(run).toThrow(/TELEGRAM_BOT_USERNAME.*TELEGRAM_WEBHOOK_SECRET.*OWNER_TELEGRAM_ID/);
    expect(run).not.toThrow(/fake-token/);
  });

  it("отвергает короткий секрет webhook и нечисловой id", () => {
    expect(() => parseAuthEnv({ ...valid, TELEGRAM_WEBHOOK_SECRET: "short" })).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
    expect(() => parseAuthEnv({ ...valid, OWNER_TELEGRAM_ID: "@some_user" })).toThrow(/OWNER_TELEGRAM_ID/);
  });
});
