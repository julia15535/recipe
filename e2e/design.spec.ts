import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Дизайн-система (ADR-0015): доступность, размер касания, шрифты без внешних запросов.
const PAGES = ["/ru", "/en", "/admin", "/admin/ui"];

test.describe("дизайн-система", () => {
  for (const path of PAGES) {
    test(`${path}: нет нарушений доступности уровня AA`, async ({ page }) => {
      await page.goto(path);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  test("/admin/ui: все цели касания не меньше 44 px, без горизонтального скролла", async ({ page }) => {
    await page.goto("/admin/ui");
    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, a[href], [role="tab"], [role="row"], input'))
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.height < 43.5)
        .map(({ el, rect }) => `${el.tagName} «${(el.textContent ?? "").trim().slice(0, 30)}» ${Math.round(rect.height)}px`),
    );
    expect(small).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("/admin/ui: переключатель шрифта меняет шрифт заголовков", async ({ page }) => {
    await page.goto("/admin/ui", { waitUntil: "networkidle" });
    const heading = page.getByRole("heading", { level: 1 });
    await expect.poll(() => heading.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Lora/);
    // Группа «один из вариантов» в React Aria — это радио-кнопки.
    await page.getByRole("radio", { name: "Literata" }).click();
    await expect.poll(() => heading.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Literata/);
  });

  test("ссылка-кнопка сама добавляет префикс локали (/en/… → «на главную» = /en)", async ({ page }) => {
    await page.goto("/en/no-such-page", { waitUntil: "networkidle" });
    const back = page.getByRole("link", { name: "Back to home" });
    await expect(back).toHaveAttribute("href", "/en");
    await back.click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("шрифты: заголовки Lora, текст Inter, без запросов к Google", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (req) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(req.url())) external.push(req.url());
    });
    await page.goto("/ru");
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => ({
      heading: getComputedStyle(document.querySelector("h1") as Element).fontFamily,
      body: getComputedStyle(document.body).fontFamily,
    }));
    expect(fonts.heading).toMatch(/Lora/);
    expect(fonts.body).toMatch(/Inter/);
    expect(external).toEqual([]);
  });
});
