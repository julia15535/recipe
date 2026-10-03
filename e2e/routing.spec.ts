import http from "node:http";

import { expect, test } from "@playwright/test";

const SITE_URL = process.env.SITE_URL ?? "https://mycoruja.food";

test.describe("локали и маршруты", () => {
  // `/` — по языку браузера и сохранённому выбору (ADR-0029); ответ не кэшируется.
  for (const [name, headers, target] of [
    ["без языка браузера", { "accept-language": "" }, "/ru"],
    ["с русским браузером", { "accept-language": "ru-RU,ru;q=0.9" }, "/ru"],
    ["с английским браузером", { "accept-language": "en-GB,en;q=0.9" }, "/en"],
    ["с сохранённым английским (cookie)", { "accept-language": "ru", cookie: "NEXT_LOCALE=en" }, "/en"],
  ] as const) {
    test(`/ ${name} ведёт на ${target}`, async ({ request }) => {
      const res = await request.get("/", { maxRedirects: 0, headers });
      expect([302, 307, 308]).toContain(res.status());
      expect(new URL(res.headers().location ?? "", "http://x").pathname).toBe(target);
      expect(res.headers()["cache-control"]).toContain("no-store");
      expect(res.headers().vary ?? "").toMatch(/Accept-Language/i);
    });
  }

  for (const [locale, text, og] of [
    ["ru", "Книга рецептов", "ru_RU"],
    ["en", "Recipe Book", "en_GB"],
  ] as const) {
    test(`/${locale} рендерится на сервере: lang, canonical, hreflang ru/en и x-default, закрыт от поисковиков`, async ({ request }) => {
      const res = await request.get(`/${locale}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain(text);
      expect(html).toMatch(new RegExp(`<html[^>]*lang="${locale}"`));
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/${locale}"`);
      // React пишет атрибут как hrefLang — HTML к регистру атрибутов нечувствителен.
      expect(html).toMatch(new RegExp(`hreflang="ru" href="${SITE_URL}/ru"`, "i"));
      expect(html).toMatch(new RegExp(`hreflang="en" href="${SITE_URL}/en"`, "i"));
      expect(html).toMatch(new RegExp(`hreflang="x-default" href="${SITE_URL}/?"`, "i"));
      expect(html).toMatch(/<meta name="robots" content="noindex/);
      expect(html).toContain(`<meta property="og:locale" content="${og}"`);
      // Единственный источник alternates — metadata; автоматический Link-заголовок next-intl выключен.
      expect(res.headers().link ?? "").not.toContain("hreflang");
    });
  }

  test("неизвестная локаль — 404", async ({ request }) => {
    expect((await request.get("/fr")).status()).toBe(404);
  });

  test("/admin — без локали, закрыт от индексации, по-русски; без входа — на /admin/login", async ({ request }) => {
    const closed = await request.get("/admin", { maxRedirects: 0, headers: { cookie: "" } });
    expect(closed.status()).toBe(307);
    expect(closed.headers().location).toMatch(/\/admin\/login$/);
    const res = await request.get("/admin/login", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<html[^>]*lang="ru"/);
    expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);
  });

  test("www перенаправляется на основной домен с сохранением пути", async ({ baseURL }) => {
    const url = new URL(baseURL ?? "http://127.0.0.1:3010");
    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      http
        .get({ host: url.hostname, port: url.port, path: "/ru?utm=1", headers: { host: "www.mycoruja.food" } }, resolve)
        .on("error", reject);
    });
    res.resume();
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe("https://mycoruja.food/ru?utm=1");
  });
});
