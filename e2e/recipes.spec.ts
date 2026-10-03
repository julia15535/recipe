import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { AI_STUB_PORT } from "./support/ai-stub";
import { TELEGRAM } from "./support/telegram";

// Добавление рецепта (планы recipe-upload, recipe-ai-parse): вставить как есть → «Разобрать» (ИИ — заглушка
// e2e/support/ai-stub.ts) → «Проверьте» и предпросмотр → черновик / публикация → изменить → удалить.
// Сбой ИИ → «Разобрать по старому формату» (разбор без ИИ). Тесты идут с сессией владельца.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — кабинет закрыт входом");

const KOTLETY = readFileSync("lib/domain/recipe-text/fixtures/kotlety.txt", "utf8");
const VAFLI = readFileSync("lib/domain/recipe-text/fixtures/vafli-v2.txt", "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);
// :visible — Next 16 держит прошлую страницу скрытой (anti-patterns №21), CSS-выборка видит и её.
const status = (page: Page) => page.locator("main [data-status]:visible").first();
const field = (page: Page) => page.getByRole("textbox", { name: "Рецепт", exact: true });
const kotlety = (title: string) => KOTLETY.replace("Мамины котлеты", title);
// Основной — только с пометкой автора (владелец 02.10).
const kotletyMain = (title: string) => kotlety(title).replace("Подаём с пюре.", "Подаём с пюре. Основной — фарш.");

async function parse(page: Page, text: string) {
  await page.goto("/admin/recipes/new");
  await field(page).fill(text);
  await page.getByRole("button", { name: "Разобрать" }).click();
}

async function aiCalls(page: Page): Promise<number> {
  return ((await (await page.request.get(`http://127.0.0.1:${AI_STUB_PORT}/__ai-calls`)).json()) as { calls: number }).calls;
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

async function deleteDraft(page: Page) {
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe("рецепт из любого текста", () => {
  test("абзац → «Разобрать» → «Проверьте» с цитатами → черновик с советами → опубликовать → снять → удалить", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Добавить рецепт" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Новый рецепт");
    await expect(page.getByRole("button", { name: "Разобрать по старому формату" })).toHaveCount(0);
    await expectPhoneFriendly(page);
    await expectNoAxeViolations(page);

    const title = `Мамины котлеты ${unique()}`;
    const before = await aiCalls(page);
    await field(page).fill(kotletyMain(title));
    await page.getByRole("button", { name: "Разобрать" }).dblclick();
    const checks = page.getByRole("region", { name: "Проверьте" });
    await expect(checks.locator('[data-checks="changed"]')).toContainText("«полкило фарша» → Фарш — 500 г");
    await expect(checks.locator('[data-checks="note"]')).toContainText("Основной ингредиент — «Фарш");
    await expect(checks.locator('[data-checks="note"]')).toContainText("Списка ингредиентов не было — ингредиенты собраны из текста");
    await expect(checks.locator('[data-checks="decide"]')).toHaveCount(0);
    expect(await aiCalls(page)).toBe(before + 1);
    const preview = page.getByRole("region", { name: "Так рецепт будет выглядеть на сайте" });
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(preview.getByRole("textbox", { name: /Фарш/ })).toHaveValue("500");
    await expectPhoneFriendly(page);
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
    await expect(status(page)).toHaveText("Черновик");
    await page.getByRole("tab", { name: "Приготовление" }).filter({ visible: true }).click();
    await expect(page.getByRole("region", { name: "Советы" }).filter({ visible: true })).toContainText("Фарш лучше брать охлаждённый.");

    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(status(page)).toHaveText("Опубликован");
    await expect(page.getByRole("button", { name: "Удалить" })).toHaveCount(0);
    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await expect(status(page)).toHaveText("Черновик");
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Отмена" }).click();
    await deleteDraft(page);
    await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
  });

  test("не рецепт — «Нужно решить», сохранить нельзя; текст остаётся", async ({ page }) => {
    await parse(page, "НЕ-РЕЦЕПТ привет, напомни про встречу");
    await expect(page.getByRole("region", { name: "Проверьте" }).locator('[data-checks="decide"]')).toContainText("не похоже на рецепт");
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeDisabled();
    await page.getByRole("button", { name: "Исправить текст" }).click();
    await expect(field(page)).toHaveValue("НЕ-РЕЦЕПТ привет, напомни про встречу");
  });

  test("сбой ИИ → понятное сообщение, текст на месте, «по старому формату» разбирает с номерами строк", async ({ page }) => {
    const text = VAFLI.replace("Творожные вафли", `Вафли ${unique()}`).replace("Теги: завтрак, белок", "Теги: завтрак, белок\nОписание: СБОЙ-ИИ");
    await parse(page, text);
    await expect(page.getByRole("alert").filter({ hasText: "сбой" })).toBeVisible();
    await expect(field(page)).toHaveValue(text);
    await expect(page.getByRole("button", { name: "Разобрать ещё раз" })).toBeVisible();
    await page.getByRole("button", { name: "Разобрать по старому формату" }).click();
    await expect(page.getByText("Всё понятно. Проверьте, как рецепт будет выглядеть на сайте.")).toBeVisible();
    await page.getByRole("button", { name: "Исправить текст" }).click();
    await field(page).fill(text.replace(" - основной ингредиент", ""));
    await page.getByRole("button", { name: "Разобрать по старому формату" }).click();
    await expect(page.getByRole("region", { name: "Что поправить" }).locator('[data-issue="no-main"]')).toContainText("без пересчёта");
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeEnabled();
  });

  test("изменить: аккуратный текст в поле → «Разобрать» → замена с тем же адресом; устаревшая вкладка не перетирает", async ({ page, context }) => {
    const title = `Котлеты ${unique()}`;
    await parse(page, kotletyMain(title));
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
    const url = page.url();

    const stale = await context.newPage();
    await stale.goto(`${url}/edit`);
    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(field(page)).toHaveValue(new RegExp(`^${title}\\n`));
    await expect(field(page)).toHaveValue(/Теги: горячее, белок\n\nИнгредиенты:\n- Фарш — 500 г \(лучше свино-говяжий\) - основной ингредиент/);
    await field(page).fill((await field(page).inputValue()).replace(title, `${title} с сыром`));
    await page.getByRole("button", { name: "Разобрать" }).click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await page.waitForURL(url);
    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText(`${title} с сыром`);
    await expect(status(page)).toHaveText("Опубликован");

    await stale.getByRole("button", { name: "Разобрать" }).click();
    await stale.getByRole("button", { name: "Сохранить" }).click();
    await expect(stale.getByRole("alert").filter({ hasText: "Рецепт уже изменён" })).toHaveText(
      "Рецепт уже изменён в другой вкладке — обновите страницу.",
    );

    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await deleteDraft(page);
  });

  test("компьютер: поле, «Проверьте» и предпросмотр без горизонтальной прокрутки @desktop", async ({ page }) => {
    await parse(page, kotlety(`Котлеты ${unique()}`));
    await expect(page.getByRole("region", { name: "Так рецепт будет выглядеть на сайте" })).toBeVisible();
    await expectPhoneFriendly(page);
    await expectNoAxeViolations(page);
  });

  test("HTML в тексте показывается как текст — и в предпросмотре, и на сохранённой странице", async ({ page }) => {
    let dialog = false;
    page.on("dialog", (event) => {
      dialog = true;
      void event.dismiss();
    });
    const title = `<img src=x onerror=alert(1)> ${unique()}`;
    await parse(page, kotlety(title));
    const preview = page.getByRole("region", { name: "Так рецепт будет выглядеть на сайте" });
    // Основной не отмечен — рецепт без пересчёта: поля «своё количество» нет, сохранить можно.
    await expect(page.getByRole("region", { name: "Проверьте" }).locator('[data-checks="note"]')).toContainText("без пересчёта");
    await expect(preview.getByRole("textbox")).toHaveCount(0);
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(preview.locator("img")).toHaveCount(0);
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText(title);
    await expect(page.locator("main img")).toHaveCount(0);
    expect(dialog).toBe(false);
    await deleteDraft(page);
  });
});
