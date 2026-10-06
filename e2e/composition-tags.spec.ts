import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { TELEGRAM } from "./support/telegram";

// Теги состава «Омега-3» и «Антиоксиданты» (план composition-tags-omega-antioxidants, ADR-0035): строка «Теги: …» →
// на рецепте оба в порядке автора, у каждого свой цвет; на карточке — первый тег автора; в фильтре поиска — все семь
// в порядке каталога, выбор в адресе (`?tag=…`); на /en — английские подписи. 320 px без прокрутки вбок, axe.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — кабинет закрыт входом");

const KOTLETY = readFileSync("lib/domain/recipe-text/fixtures/kotlety.txt", "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);
const RU = ["Белок", "Клетчатка", "Полезные жиры", "Омега-3", "Мало сахара", "Железо", "Антиоксиданты"];
const EN = ["Protein", "Fiber", "Healthy fats", "Omega-3", "Low sugar", "Iron", "Antioxidants"];

async function expectGood(page: Page) {
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

const chips = (page: Page, name: string) => page.getByRole("grid", { name }).getByRole("row");

test("новые теги: рецепт → свои цвета → карточка → фильтр поиска (RU и EN)", async ({ page }) => {
  test.setTimeout(90_000);
  const title = `Котлеты с тегами ${unique()}`;
  await page.goto("/admin/recipes/new");
  const text = `${KOTLETY.replace("Мамины котлеты", title)}\nТеги: горячее, омега‑3, антиоксиданты`;
  await page.getByRole("textbox", { name: "Рецепт", exact: true }).fill(text);
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
  const cabinet = page.url();

  await page.getByRole("link", { name: "Открыть на сайте" }).click();
  await page.waitForURL(/\/ru\/recipe\/[a-z0-9-]+$/);
  const tags = page.getByRole("list", { name: "Особенности состава" }).locator("[data-tag]");
  await expect(tags).toHaveText(["Омега-3", "Антиоксиданты"]);
  const colors = await tags.evaluateAll((els) => els.map((el) => [el.getAttribute("data-tag"), getComputedStyle(el).backgroundColor, getComputedStyle(el).color]));
  expect(colors).toEqual([
    ["omega-3", "rgb(220, 239, 232)", "rgb(36, 92, 82)"],
    ["antioxidants", "rgb(233, 227, 243)", "rgb(74, 55, 109)"],
  ]);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await expectGood(page);
  }

  // Карточка на главной — первый тег автора.
  await page.goto("/ru", { waitUntil: "networkidle" });
  await expect(page.locator("main ul > li > a").filter({ hasText: title }).locator("[data-tag]")).toHaveText(["Омега-3"]);

  // Фильтр поиска: семь тегов в порядке каталога; «Антиоксиданты» → в адресе, рецепт найден.
  await page.goto("/ru/search", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Уточнить" }).click();
  await expect(chips(page, "Особенности состава")).toHaveText(RU);
  await chips(page, "Особенности состава").filter({ hasText: "Антиоксиданты" }).click();
  await expect(page).toHaveURL(/tag=antioxidants/);
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expectGood(page);
  await page.goto("/ru/search?tag=omega-3", { waitUntil: "networkidle" });
  await expect(chips(page, "Особенности состава").filter({ hasText: "Омега-3" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  // Английский фильтр — подписи из базы.
  await page.goto("/en/search", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Refine" }).click();
  await expect(chips(page, "Nutrition highlights")).toHaveText(EN);
  await expectGood(page);

  await page.goto(cabinet);
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
});
