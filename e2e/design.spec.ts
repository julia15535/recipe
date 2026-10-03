import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { TELEGRAM } from "./support/telegram";

// Дизайн-система (ADR-0015): доступность, размер касания, шрифты без внешних запросов.
// Кабинет и пробные экраны закрыты входом: без секрета webhook (e2e против прода) их не проверить.
const ADMIN = ["/admin/ui", "/admin/ui/home", "/admin/ui/search", "/admin/ui/recipe/syrniki", "/admin/ui/recipe/bowl", "/admin/ui/recipe/vafli-iz-tvoroga", "/admin/ui/section/soups"];
const PROTOTYPES = TELEGRAM.enabled ? ADMIN : [];
const PAGES = ["/ru", "/en", "/ru/search", "/ru/catalog/zagotovki", ...(TELEGRAM.enabled ? ["/admin", ...PROTOTYPES] : [])];

test.describe("дизайн-система", () => {
  for (const path of PAGES) {
    test(`${path}: нет нарушений доступности уровня AA`, async ({ page }) => {
      // networkidle: поиск-прототип дорисовывается в браузере (раздел читается из адреса).
      await page.goto(path, { waitUntil: "networkidle" });
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  for (const path of PROTOTYPES) {
    test(`${path}: все цели касания не меньше 44 px, без горизонтального скролла`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
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
  }

  test("ссылка-кнопка сама добавляет префикс локали (/en/… → «на главную» = /en)", async ({ page }) => {
    await page.goto("/en/no-such-page", { waitUntil: "networkidle" });
    const back = page.getByRole("link", { name: "Back to home" });
    await expect(back).toHaveAttribute("href", "/en");
    await back.click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("шрифты: заголовки Prata без «нарисованного» жирного, текст Manrope, без запросов к Google", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (req) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(req.url())) external.push(req.url());
    });
    // На главной заголовок h1 только для читалок экрана — берём страницу раздела с видимым заголовком.
    await page.goto("/ru/catalog/zagotovki");
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => {
      const h1 = getComputedStyle(document.querySelector("h1") as Element);
      const sign = document.querySelector("[data-logo-signature]");
      return {
        heading: h1.fontFamily,
        synthesis: h1.fontSynthesis,
        body: getComputedStyle(document.body).fontFamily,
        signature: sign ? getComputedStyle(sign).fontFamily : "",
      };
    });
    expect(fonts.heading).toMatch(/Prata/);
    expect(fonts.synthesis).toBe("none");
    expect(fonts.body).toMatch(/Manrope/);
    expect(fonts.signature).toMatch(/Great Vibes/);
    expect(external).toEqual([]);
  });
});
