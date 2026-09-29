import { expect, test } from "@playwright/test";

test.describe("платформа", () => {
  test("live отвечает без БД-зависимости", async ({ request }) => {
    const res = await request.get("/api/health/live");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("ready: БД доступна, версия — коммит сборки", async ({ request }) => {
    const res = await request.get("/api/health/ready");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, db: true });
    if (process.env.E2E_EXPECT_SHA) expect(body.version).toBe(process.env.E2E_EXPECT_SHA);
  });

  test("заголовки безопасности на месте, X-Powered-By нет", async ({ request }) => {
    const headers = (await request.get("/ru")).headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBeTruthy();
    expect(headers["permissions-policy"]).toBeTruthy();
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("до запуска сайт закрыт от поисковиков", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/\s*$/m);
    const html = await (await request.get("/ru")).text();
    expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);
  });
});

test.describe("мобильный экран 375 px", () => {
  for (const path of ["/ru", "/en", "/admin"]) {
    test(`${path}: нет горизонтального скролла`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("Tab попадает на интерактивный элемент с видимым фокусом", async ({ page }) => {
    await page.goto("/ru");
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { tag: el.tagName, visible: style.outlineStyle !== "none" || style.boxShadow !== "none" };
    });
    expect(["A", "BUTTON"]).toContain(focus?.tag);
    expect(focus?.visible).toBe(true);
  });
});
