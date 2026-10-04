import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { TELEGRAM } from "./support/telegram";

// Английская версия (план english-version, ADR-0029): опубликовать в кабинете → ИИ (заглушка: «EN » перед текстами)
// переводит после ответа → рецепт на /en; правка русского — «устарела», на /en прежний перевод; «Перевести заново»
// → обновлено; снять с публикации — нет и на /en.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — кабинет закрыт входом");

const KOTLETY = readFileSync("lib/domain/recipe-text/fixtures/kotlety.txt", "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);
const h1 = (page: Page) => page.getByRole("heading", { level: 1 }).filter({ visible: true });
// :visible — Next 16 держит прошлую страницу скрытой после перехода.
const translation = (page: Page) => page.locator("[data-translation]:visible");

test("опубликовать → перевод на /en; правка → «устарела»; перевести заново; снять — нет и на /en", async ({ page }) => {
  test.setTimeout(150_000);
  const title = `Котлеты ${unique()}`;
  await page.goto("/admin/recipes/new");
  await page.getByRole("textbox", { name: "Рецепт", exact: true }).fill(KOTLETY.replace("Мамины котлеты", title).replace("Подаём с пюре.", "Подаём с пюре. Основной — фарш."));
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
  const cabinet = page.url();

  // Перевод идёт после ответа; кабинет сам обновляет статус.
  await expect(translation(page)).toHaveAttribute("data-translation", "ready", { timeout: 60_000 });
  await expect(translation(page)).toHaveText("готова");
  await page.getByRole("link", { name: "Открыть по-английски" }).click();
  await page.waitForURL(/\/en\/recipe\/[a-z0-9-]+$/);
  const english = new URL(page.url()).pathname;
  await expect(h1(page)).toHaveText(`EN ${title}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_GB");
  await expect(page.getByRole("tab", { name: "Method" })).toBeVisible();
  // Единицы и пересчёт по-английски: граммы — g, штуки без единицы, числа — с точкой.
  const main = page.getByRole("textbox", { name: /EN Фарш/ });
  await expect(main).toHaveValue("500");
  await expect(page.getByText("g", { exact: true }).first()).toBeVisible();
  // Запись автора (ADR-0032): «1/2 стакана» — дробью и по-английски, после пересчёта ×2 — «≈ 1».
  const milk = page.getByRole("listitem").filter({ hasText: "EN Молоко" }).getByTestId("ingredient-amount");
  await expect(milk).toHaveText(/^1\/2 cup/);
  await main.fill("1000");
  await expect(milk).toHaveText(/^≈ 1 cup/);
  await expect(page.getByRole("listitem").filter({ hasText: "EN Лук" })).toContainText("≈ 2");
  await expect(page.getByTestId("servings")).toContainText("24 servings");
  const russian = await page.getByRole("banner").getByRole("link", { name: "Русский" }).getAttribute("href");
  expect(russian).toMatch(/^\/ru\/recipe\/kotlety-/);
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  // Главная и поиск на английском видят перевод; русская страница ведёт на английскую.
  await page.goto("/en");
  await expect(page.locator("main:visible ul > li > a").first()).toContainText(`EN ${title}`);
  await page.goto("/en/search", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Recipe name" }).fill(`EN ${title}`);
  await expect(page.getByRole("link", { name: new RegExp(`EN ${title}`) })).toBeVisible();
  await page.goto(russian ?? "/ru");
  await expect(page.getByRole("banner").getByRole("link", { name: "English" })).toHaveAttribute("href", english);
  // По-русски из базы: «1/2 стак.» дробью; ×0,5 — «≈ 1/4 стак.», запись строки сохраняется (ADR-0032).
  const milkRu = page.getByRole("listitem").filter({ hasText: "Молоко" }).getByTestId("ingredient-amount");
  await expect(milkRu).toHaveText(/^1\/2 стак/);
  await page.getByRole("textbox", { name: /Фарш/ }).fill("250");
  await expect(milkRu).toHaveText(/^≈ 1\/4 стак/);

  // Правка русского — английский прежний, в кабинете «устарела».
  await page.goto(`${cabinet}/edit`);
  const field = page.getByRole("textbox", { name: "Рецепт", exact: true });
  const edited = (await field.inputValue()).replace(title, `${title} с сыром`);
  expect(edited).toContain("Молоко — 1/2 стак.");
  await field.fill(edited.replace("Молоко — 1/2", "Молоко — 0,5"));
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.waitForURL(cabinet);
  await expect(translation(page)).toHaveAttribute("data-translation", "outdated");
  // По-русски — уже «0,5», как переписала автор; английский — прежний снимок с «1/2».
  await page.goto(russian ?? "/ru");
  await expect(milkRu).toHaveText(/^0,5 стак/);
  await page.getByRole("textbox", { name: /Фарш/ }).fill("250");
  await expect(milkRu).toHaveText(/^≈ 0,25 стак/);
  await page.goto(english);
  await expect(h1(page)).toHaveText(`EN ${title}`);
  await expect(milk).toHaveText(/^1\/2 cup/);

  // «Перевести заново» — тот же адрес, новый текст.
  await page.goto(cabinet);
  await page.getByRole("button", { name: "Перевести заново" }).click();
  await expect(translation(page)).toHaveAttribute("data-translation", "ready", { timeout: 60_000 });
  await page.goto(english);
  await expect(h1(page)).toHaveText(`EN ${title} с сыром`);
  await expect(milk).toHaveText(/^0\.5 cup/);

  // Снять с публикации — нет и на английском.
  await page.goto(cabinet);
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
  await page.goto(english);
  await expect(h1(page)).toHaveText("Page not found");
  await page.goto(cabinet);
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
});
