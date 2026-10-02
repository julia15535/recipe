import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { TELEGRAM } from "./support/telegram";

// Загрузка рецепта в кабинете (план recipe-upload): вставить текст как пишет владелец → предпросмотр
// и «Что поправить» → черновик / публикация → изменить → удалить. Тесты идут с сессией владельца.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — кабинет закрыт входом");

const VAFLI = readFileSync("lib/domain/recipe-text/fixtures/vafli-v2.txt", "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);
// :visible — Next 16 держит прошлую страницу скрытой (anti-patterns №21), CSS-выборка видит и её.
const status = (page: Page) => page.locator("main [data-status]:visible").first();

async function check(page: Page, text: string) {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Текст рецепта").fill(text);
  await page.getByRole("button", { name: "Проверить" }).click();
}

async function expectNoAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

async function expectPhoneFriendly(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href], [role="tab"], input, textarea'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 2 && rect.height > 2 && rect.height < 43.5)
      .map(({ el, rect }) => `${el.tagName} «${(el.textContent ?? "").trim().slice(0, 30)}» ${Math.round(rect.height)}px`),
  );
  expect(small).toEqual([]);
}

test.describe("загрузка рецепта", () => {
  test("вафли как есть → предпросмотр без замечаний → черновик → опубликовать → снять → удалить", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Добавить рецепт" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Новый рецепт");
    await expectPhoneFriendly(page);
    await expectNoAxeViolations(page);

    const title = `Творожные вафли ${unique()}`;
    await page.getByLabel("Текст рецепта").fill(VAFLI.replace("Творожные вафли", title));
    await page.getByRole("button", { name: "Проверить" }).click();
    await expect(page.getByText("Всё понятно. Проверьте, как рецепт будет выглядеть на сайте.")).toBeVisible();
    const preview = page.getByRole("region", { name: "Так рецепт будет выглядеть на сайте" });
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(preview.getByRole("navigation", { name: "Разделы каталога" })).toHaveText("Завтраки");
    await expect(preview.getByTestId("recipe-meta")).toHaveText("Белок");
    await expect(preview.getByRole("textbox", { name: "Творог 0,5%" })).toHaveValue("275");
    const row = (name: string) => preview.getByRole("listitem").filter({ hasText: name });
    await expect(row("Соль")).toContainText("щепотка");
    await expect(row("Чёрный перец")).toContainText("по желанию");
    await expect(row("Молоко")).toContainText("1 ст. л., если творог сухой");
    await preview.getByRole("textbox", { name: "Творог 0,5%" }).fill("550");
    await expect(row("Разрыхлитель")).toContainText("1 ч. л.");
    await expectPhoneFriendly(page);
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
    await expect(status(page)).toHaveText("Черновик");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expectPhoneFriendly(page);

    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(status(page)).toHaveText("Опубликован");
    await expect(page.getByText("Появится на сайте, когда откроем страницы рецептов.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Удалить" })).toHaveCount(0);
    await page.getByRole("link", { name: "← Мои рецепты" }).click();
    await expect(page.getByRole("link", { name: new RegExp(title) })).toContainText("Опубликован");

    await page.getByRole("link", { name: new RegExp(title) }).click();
    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await expect(status(page)).toHaveText("Черновик");
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Да, удалить" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
  });

  test("непонятное — с номером строки простыми словами; с ошибками сохранить нельзя; текст не теряется", async ({ page }) => {
    const text = "Сырники\nТеги: завтрак, вкуснота\nИнгредиенты:\n- Творог — 500 г\n- Соль\nПриготовление:\n1. Смешать.";
    await check(page, text);
    const issues = page.getByRole("region", { name: "Что поправить" });
    await expect(issues.locator('[data-issue="no-main"]')).toContainText("Не отмечен основной ингредиент");
    await expect(issues.locator('[data-issue="no-main"]')).toContainText("«Творог»");
    await expect(issues.locator('[data-issue="ingredient-no-amount"]')).toContainText("Строка 5: У «Соль» нет количества");
    await expect(issues.locator('[data-issue="unknown-tag"]')).toContainText("«вкуснота»");
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeDisabled();
    await page.getByRole("button", { name: "Исправить текст" }).click();
    await expect(page.getByLabel("Текст рецепта")).toHaveValue(text);
  });

  test("изменить: новая версия текста, адрес и статус те же; устаревшая вкладка не перетирает", async ({ page, context }) => {
    const title = `Омлет ${unique()}`;
    await check(page, `${title}\nТеги: завтрак\nИнгредиенты:\n- Яйца — 3 шт. - основной\n- Молоко — ⅓ стакана\nПриготовление:\n1. Взбить.\n2. Пожарить.`);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
    const url = page.url();

    const stale = await context.newPage();
    await stale.goto(`${url}/edit`);
    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(page.getByLabel("Текст рецепта")).toHaveValue(/Молоко — ⅓ стакана/);
    await page.getByLabel("Текст рецепта").fill((await page.getByLabel("Текст рецепта").inputValue()).replace(title, `${title} с сыром`));
    await page.getByRole("button", { name: "Проверить" }).click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await page.waitForURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} с сыром`);
    await expect(status(page)).toHaveText("Опубликован");

    await stale.getByRole("button", { name: "Проверить" }).click();
    await stale.getByRole("button", { name: "Сохранить" }).click();
    await expect(stale.getByRole("alert").filter({ hasText: "Рецепт уже изменён" })).toHaveText(
      "Рецепт уже изменён в другой вкладке — обновите страницу.",
    );
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} с сыром`);

    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Да, удалить" }).click();
    await page.waitForURL(/\/admin$/);
  });

  test("компьютер: поле и предпросмотр без горизонтальной прокрутки, кнопки удобного размера @desktop", async ({ page }) => {
    await check(page, VAFLI.replace("Творожные вафли", `Вафли ${unique()}`));
    await expect(page.getByRole("region", { name: "Так рецепт будет выглядеть на сайте" })).toBeVisible();
    await expectPhoneFriendly(page);
    await expectNoAxeViolations(page);
  });

  test("HTML в тексте рецепта показывается как текст", async ({ page }) => {
    let dialog = false;
    page.on("dialog", (event) => {
      dialog = true;
      void event.dismiss();
    });
    await check(page, `Тест ${unique()}\nОписание: <img src=x onerror=alert(1)>\nТеги: соус\nИнгредиенты:\n- Вода — 1 л - основной\nПриготовление:\n1. <b>Налить</b>.`);
    const preview = page.getByRole("region", { name: "Так рецепт будет выглядеть на сайте" });
    await expect(preview.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
    await expect(preview.locator("img")).toHaveCount(0);
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
    await expect(page.getByText("<img src=x onerror=alert(1)>").filter({ visible: true })).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(0);
    expect(dialog).toBe(false);
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Да, удалить" }).click();
    await page.waitForURL(/\/admin$/);
  });
});
