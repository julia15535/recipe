import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import sharp from "sharp";

import { AI_STUB_PORT } from "./support/ai-stub";
import { TELEGRAM } from "./support/telegram";

// Статьи (план articles, ADR-0034): новая статья → «Разобрать» (ИИ — заглушка: «#» заголовок, «-» пункт) → черновик →
// «Добавить фото сюда» (уменьшение → кадр) → связанный рецепт → опубликовать → сайт (статья, фото, рецепт, блок на
// рецепте и на главной) → «Изменить»: метку фото перенесли — разметка переносится без ИИ, фото на новом месте →
// метку стёрли — предупреждение и «Фото без места» → убрать → снять, удалить. Тексты владельца — слово в слово; 320 / 375 /
// 1280 px без прокрутки вбок, axe — на статье, в кабинете, на рецепте и на главной.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — кабинет закрыт входом");

const KOTLETY = readFileSync("lib/domain/recipe-text/fixtures/kotlety.txt", "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);
const TEXT = `Вафли можно подать по-разному — вот любимые варианты 🧇

# С творожным сыром и рыбой
Намажьте вафлю творожным сыром, сверху — ломтики рыбы.

# С ветчиной
- ветчина
- огурец`;

async function aiCalls(page: Page): Promise<number> {
  return ((await (await page.request.get(`http://127.0.0.1:${AI_STUB_PORT}/__ai-calls`)).json()) as { calls: number }).calls;
}

async function expectGood(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // Служебный «объявитель» React Aria ([data-live-announcer]) после окна кадрирования ещё несколько секунд ссылается на
  // убранную подпись — не элемент страницы (anti-patterns №55).
  const result = await new AxeBuilder({ page }).exclude("[data-live-announcer]").withTags(AXE_TAGS).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

const photoFile = async () => ({
  name: "IMG_0005.jpg",
  mimeType: "image/jpeg",
  buffer: await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#c96" } }).jpeg().toBuffer(),
});

test("статья: текст → фото между абзацами → связанный рецепт → сайт → перенос метки → убрать фото", async ({ page }) => {
  test.setTimeout(150_000);
  const id = unique();
  const recipeTitle = `Котлеты к статье ${id}`;
  await page.goto("/admin/recipes/new");
  await page.getByRole("textbox", { name: "Рецепт", exact: true }).fill(KOTLETY.replace("Мамины котлеты", recipeTitle));
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
  const recipeCabinet = page.url();

  // Новая статья: название пишет владелец, ИИ только размечает строки.
  const title = `Вафли — подача ${id}`;
  await page.goto("/admin");
  await page.getByRole("link", { name: "Новая статья" }).click();
  await page.getByRole("textbox", { name: "Название" }).fill(title);
  await page.getByRole("textbox", { name: "Текст статьи" }).fill(TEXT);
  await page.getByRole("button", { name: "Разобрать" }).click();
  const preview = page.getByRole("region", { name: "Так статья будет выглядеть на сайте" });
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(preview.getByRole("heading", { level: 2 })).toHaveText(["С творожным сыром и рыбой", "С ветчиной"]);
  await expect(preview.getByText("Вафли можно подать по-разному — вот любимые варианты 🧇")).toBeVisible();
  await expect(preview.getByRole("listitem")).toHaveText(["ветчина", "огурец"]);
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await page.waitForURL(/\/admin\/articles\/[0-9a-f-]{36}$/);
  const cabinet = page.url();

  // Фото после первого абзаца: уменьшение в браузере → кадр 4:3 → сервер ставит метку в текст.
  const chooser = page.waitForEvent("filechooser");
  await page.locator('[data-add-photo="b1"]').click();
  await (await chooser).setFiles(await photoFile());
  const dialog = page.getByRole("dialog", { name: "Кадр для фото" });
  await dialog.getByRole("button", { name: "Готово" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("Фото сохранено.")).toBeVisible();
  const figure = page.locator("main figure[data-photo]");
  await expect(figure).toHaveCount(1);
  const key = (await figure.getAttribute("data-photo")) ?? "";
  expect(key).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  await expectGood(page);

  // Связанный рецепт и публикация.
  await page.getByRole("button", { name: recipeTitle }).click();
  await page.getByRole("button", { name: "Сохранить связи" }).click();
  await expect(page.getByText("Связи сохранены.")).toBeVisible();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.getByRole("link", { name: "Открыть на сайте" }).click();
  await page.waitForURL(/\/ru\/articles\/[a-z0-9-]+$/);
  const site = new URL(page.url()).pathname;
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const img = page.locator(`main figure[data-photo="${key}"] img`);
  await expect(img).toHaveAttribute("src", /^\/media\/article\/[0-9a-f-]{36}\/960\.webp$/);
  await expect(img).toHaveAttribute("alt", title);
  await expect(page.getByRole("link", { name: new RegExp(recipeTitle) })).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/media\/article\/.+\/og\.jpg$/);
  await expectGood(page);
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectGood(page);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  // Фото стоит после первого абзаца — перед заголовком «С творожным сыром и рыбой».
  expect(await page.locator("main article > *").evaluateAll((els) => els.map((el) => el.tagName))).toEqual(["H1", "P", "FIGURE", "H2", "P", "H2", "UL", "SECTION"]);

  // Рецепт ведёт на статью; на главной — блок «Статьи».
  await page.getByRole("link", { name: new RegExp(recipeTitle) }).click();
  await expect(page.getByRole("region", { name: "Статьи по рецепту" }).getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectGood(page);
  await page.goto("/ru", { waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: "Статьи" }).getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expectGood(page);

  // «Изменить»: метку перенесли в конец — слова те же, разметка переносится без ИИ, фото на новом месте.
  await page.goto(`${cabinet}/edit`);
  const field = page.getByRole("textbox", { name: "Текст статьи" });
  const text = await field.inputValue();
  expect(text).toContain(`[Фото ${key}]`);
  await field.fill(`${text.replace(`[Фото ${key}]\n\n`, "")}\n\n[Фото ${key}]`);
  const before = await aiCalls(page);
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.waitForURL(cabinet);
  expect(await aiCalls(page)).toBe(before);
  await page.goto(site, { waitUntil: "networkidle" });
  expect(await page.locator("main article > *").evaluateAll((els) => els.map((el) => el.tagName))).toEqual(["H1", "P", "H2", "P", "H2", "UL", "FIGURE", "SECTION"]);

  // Метку стёрли в тексте — предупреждение до сохранения, фото «без места» (на сайте его нет) → убрать его там.
  await page.goto(`${cabinet}/edit`);
  await field.fill((await field.inputValue()).replace(`\n\n[Фото ${key}]`, ""));
  await page.getByRole("button", { name: "Разобрать" }).click();
  await expect(page.locator('[data-checks="note"]')).toContainText(`Фото «[Фото ${key}]» без места`);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.waitForURL(cabinet);
  const loose = page.getByRole("region", { name: "Фото без места" });
  await expect(loose).toContainText(`[Фото ${key}]`);
  await expect(page.locator("main figure[data-photo]")).toHaveCount(0);
  await page.goto(site, { waitUntil: "networkidle" });
  await expect(page.locator("main figure")).toHaveCount(0);
  await page.goto(cabinet);
  await loose.getByRole("button", { name: "Убрать фото" }).click();
  await loose.getByRole("button", { name: "Да, убрать" }).click();
  await expect(page.getByText("Фото убрано.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Фото без места" })).toHaveCount(0);
  // Снять, удалить черновик; рецепт — тоже.
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await page.goto(site);
  await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
  await page.goto(cabinet);
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
  await page.goto(recipeCabinet);
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
});

test("статьи на сайте: список, ссылка в меню каталога; неизвестная и /en — «Страница не найдена»", async ({ page }) => {
  await page.goto("/ru/articles", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Статьи");
  await expectGood(page);
  await page.goto("/ru", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Каталог" }).click();
  await page.getByRole("dialog", { name: "Каталог" }).getByRole("link", { name: "Статьи" }).click();
  await expect(page).toHaveURL(/\/ru\/articles$/);
  for (const path of ["/en/articles", "/ru/articles/net-takoy-statyi"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Страница не найдена|Page not found/);
  }
});

test("компьютер: «Статьи» в шапке перед «Поиск» @desktop", async ({ page }) => {
  await page.goto("/ru", { waitUntil: "networkidle" });
  const banner = page.getByRole("banner");
  const [articles, search] = [await banner.getByRole("link", { name: "Статьи" }).boundingBox(), await banner.getByRole("link", { name: "Поиск" }).boundingBox()];
  if (!articles || !search) throw new Error("нет ссылок в шапке");
  expect(articles.x + articles.width).toBeLessThanOrEqual(search.x);
  expect((await banner.boundingBox())?.height ?? 999).toBeLessThanOrEqual(150);
  await banner.getByRole("link", { name: "Статьи" }).click();
  await expect(page).toHaveURL(/\/ru\/articles$/);
});
