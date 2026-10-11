import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { TELEGRAM } from "./support/telegram";

// Статьи на английском (план articles-en, ADR-0038): опубликовать → ИИ (заглушка: «EN » перед текстами) переводит сам →
// /en/articles и статья с жирным и курсивом, пара RU/EN; правка русской → «устарела» → «Перевести заново»; 320 px, axe.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — кабинет закрыт входом");

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);
const translation = (page: Page) => page.locator("[data-translation]:visible");

async function expectGood(page: Page) {
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const result = await new AxeBuilder({ page }).exclude("[data-live-announcer]").withTags(AXE_TAGS).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test("статья: опубликовать → перевод сам → /en с оформлением, пара RU/EN; правка → «устарела» → «Перевести заново»", async ({ page }) => {
  test.setTimeout(150_000);
  const title = `Подача ${unique()}`;
  await page.goto("/admin");
  await page.getByRole("link", { name: "Новая статья" }).click();
  await page.getByRole("textbox", { name: "Название" }).fill(title);
  const field = page.getByRole("textbox", { name: "Текст статьи" });
  await field.fill("Добавьте **соль** в *самом* конце, при 180 °C.\n\n# Как подавать\n- с рыбой\n- с сыром");
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await page.waitForURL(/\/admin\/articles\/[0-9a-f-]{36}$/);
  const cabinet = page.url();
  await expect(translation(page)).toHaveText("появится после публикации");
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(translation(page)).toHaveAttribute("data-translation", "ready", { timeout: 60_000 });

  await page.getByRole("link", { name: "Открыть по-английски" }).click();
  await page.waitForURL(/\/en\/articles\/[a-z0-9-]+$/);
  const english = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`EN ${title}`);
  await expect(page.locator("main article strong")).toHaveText("соль");
  await expect(page.locator("main article em")).toHaveText("самом");
  await expect(page.locator("main article p").first()).toContainText("180 °C");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("EN Как подавать");
  await expect(page.locator("main article li")).toHaveText(["EN с рыбой", "EN с сыром"]);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await expectGood(page);
  }
  // Кнопка RU — на ту же статью по-русски, и обратно.
  await page.getByRole("banner").getByRole("link", { name: "Русский" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await page.getByRole("banner").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(new RegExp(`${english}$`));
  await page.goto("/en/articles", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: new RegExp(`EN ${title}`) })).toContainText("EN Добавьте соль в самом конце");
  await page.goto("/en", { waitUntil: "networkidle" });
  // На телефоне «Articles» — в меню каталога (в шапке — на компьютере).
  await page.getByRole("button", { name: "Catalogue" }).click();
  await page.getByRole("dialog", { name: "Catalogue" }).getByRole("link", { name: "Articles" }).click();
  await expect(page).toHaveURL(/\/en\/articles$/);

  // Правка русской статьи — английская прежняя, «устарела»; «Перевести заново» — тот же адрес, новый текст.
  await page.goto(`${cabinet}/edit`);
  await field.fill(`${await field.inputValue()}\n\nЕщё абзац.`);
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.waitForURL(cabinet);
  await expect(translation(page)).toHaveAttribute("data-translation", "outdated");
  await page.getByRole("button", { name: "Перевести заново" }).click();
  await expect(translation(page)).toHaveAttribute("data-translation", "ready", { timeout: 60_000 });
  await page.goto(english, { waitUntil: "networkidle" });
  await expect(page.locator("main article")).toContainText("EN Ещё абзац.");

  await page.goto(cabinet);
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
  await page.goto(english);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await page.goto(cabinet);
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
});
