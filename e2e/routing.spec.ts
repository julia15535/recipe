import http from "node:http";

import { expect, test } from "@playwright/test";

const SITE_URL = process.env.SITE_URL ?? "https://mycoruja.food";

test.describe("локали и маршруты", () => {
  // Пока английской версии нет (план public-pages): `/` всегда на /ru — язык браузера и cookie не учитываются.
  for (const [name, headers] of [
    ["без языка браузера", { "accept-language": "" }],
    ["с английским браузером", { "accept-language": "en-US,en;q=0.9" }],
    ["с сохранённым английским (cookie)", { "accept-language": "ru", cookie: "NEXT_LOCALE=en" }],
  ] as const) {
    test(`/ ${name} ведёт на /ru`, async ({ request }) => {
      const res = await request.get("/", { maxRedirects: 0, headers });
      expect([302, 307, 308]).toContain(res.status());
      expect(new URL(res.headers().location ?? "", "http://x").pathname).toBe("/ru");
    });
  }

  test("/ru рендерится на сервере: lang, canonical, hreflang только ru, закрыт от поисковиков", async ({ request }) => {
    const res = await request.get("/ru");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("Книга рецептов");
    expect(html).toMatch(/<html[^>]*lang="ru"/);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/ru"`);
    // React пишет атрибут как hrefLang — HTML к регистру атрибутов нечувствителен.
    expect(html).toMatch(new RegExp(`hreflang="ru" href="${SITE_URL}/ru"`, "i"));
    expect(html).not.toMatch(/hreflang="(en|x-default)"/i);
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    expect(html).toContain(`<meta property="og:url" content="${SITE_URL}/ru"`);
    // Единственный источник alternates — metadata; автоматический Link-заголовок next-intl выключен.
    expect(res.headers().link ?? "").not.toContain("hreflang");
  });

  test("/en — заглушка на английском с noindex", async ({ request }) => {
    const res = await request.get("/en");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toContain("English version is coming soon");
    expect(html).toMatch(/<meta name="robots" content="noindex/);
  });

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
