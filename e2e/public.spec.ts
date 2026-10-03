import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { TELEGRAM } from "./support/telegram";

// Публичный сайт из базы (план public-pages): опубликовать в кабинете → сразу на главной, в разделе, в поиске
// и по адресу → изменить → сразу обновлено → снять → исчез. Рецепт создаётся через кабинет и заглушку ИИ
// (e2e/support/ai-stub.ts: котлеты, раздел «Горячее»); без входа владельца (e2e против прода) — только то, что
// не требует своих данных.
const KOTLETY = readFileSync("lib/domain/recipe-text/fixtures/kotlety.txt", "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);
const h1 = (page: Page) => page.getByRole("heading", { level: 1 }).filter({ visible: true });
const cards = (page: Page) => page.locator("main:visible ul > li > a");

// networkidle: пока страница дорисовывается (шрифты, появление вкладок), axe видит промежуточные цвета.
async function expectPhoneFriendly(page: Page) {
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href], [role="tab"], [role="row"], input'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 2 && rect.height > 2 && rect.height < 43.5)
      .map(({ el, rect }) => `${el.tagName} «${(el.textContent ?? "").trim().slice(0, 30)}» ${Math.round(rect.height)}px`),
  );
  expect(small).toEqual([]);
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

// У страницы 404 robots бывает несколько (layout, страница, сама 404) — все должны закрывать индексацию.
async function expectNoindex(page: Page) {
  const values = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
  expect(values.length).toBeGreaterThan(0);
  expect(values.filter((value) => !value.includes("noindex"))).toEqual([]);
}

async function publish(page: Page, title: string): Promise<string> {
  await page.goto("/admin/recipes/new");
  await page.getByRole("textbox", { name: "Рецепт", exact: true }).fill(KOTLETY.replace("Мамины котлеты", title).replace("Подаём с пюре.", "Подаём с пюре. Основной — фарш."));
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
  return page.url();
}

// Логотип (ADR-0033): подпись Great Vibes под названием (центр ниже названия), внутри ссылки (рамка фокуса — вокруг
// обеих строк) и экрана; справа — не ближе 4 px к лупе, снизу — не ближе 2 px к краю строки шапки (на компьютере —
// к ленте каталога; рамка повёрнутой подписи больше самих букв); шрифт загружен с нашего сайта.
async function expectSignature(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const box = (selector: string) =>
    page.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => (e as HTMLElement).offsetParent !== null);
      const r = el?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height } : null;
    }, selector);
  const [title, sign, link, search, banner] = [
    await box("[data-logo-title]"),
    await box("[data-logo-signature]"),
    await box("header a:has([data-logo-title])"),
    await box('header a[href$="/search"]'),
    await box("header"),
  ];
  if (!title || !sign || !link || !search || !banner) throw new Error("нет названия, подписи, ссылки, лупы или шапки");
  expect(sign.y + sign.height / 2).toBeGreaterThan(title.bottom);
  expect(sign.x).toBeGreaterThanOrEqual(0);
  expect(sign.y).toBeGreaterThanOrEqual(banner.y);
  expect(sign.bottom).toBeLessThanOrEqual(link.bottom + 1);
  expect(link.height).toBeGreaterThanOrEqual(44);
  expect(sign.right + 4).toBeLessThanOrEqual(search.x);
  const ribbon = await box("header nav[aria-label]");
  expect(sign.bottom + 2).toBeLessThanOrEqual(ribbon ? ribbon.y : banner.bottom);
  const variable = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-header-height")) * 16);
  expect(Math.abs(banner.height - variable)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.fonts.check("32px 'Great Vibes'", "Юлианы Yuliana"))).toBe(true);
}

test.describe("публичный сайт", () => {
  test("опубликовать → сразу везде; изменить → сразу обновлено; снять → исчез, адрес — 404", async ({ page }) => {
    test.skip(!TELEGRAM.enabled, "нет входа владельца — свой рецепт не опубликовать");
    const title = `Котлеты ${unique()}`;
    const cabinet = await publish(page, title);

    await page.getByRole("link", { name: "Открыть на сайте" }).click();
    await page.waitForURL(/\/ru\/recipe\/kotlety-[a-z0-9-]+$/);
    const address = new URL(page.url()).pathname;
    await expect(h1(page)).toHaveText(title);
    await expectNoindex(page);
    // Пересчёт и округление — как в кабинете: фарша вдвое больше → лука ≈ 2 шт.
    const main = page.getByRole("textbox", { name: /Фарш/ });
    await expect(main).toHaveValue("500");
    await main.fill("1000");
    await expect(page.getByRole("listitem").filter({ hasText: "Лук" })).toContainText("2 шт.");
    await expectPhoneFriendly(page);
    // Шапка закреплена при прокрутке.
    await page.mouse.wheel(0, 1500);
    await expect.poll(async () => (await page.getByRole("banner").boundingBox())?.y).toBe(0);

    // Раздел над названием → страница раздела с этим рецептом; в каталоге он текущий.
    await page.getByRole("navigation", { name: "Разделы каталога" }).getByRole("link", { name: "Горячее" }).click();
    await page.waitForURL(/\/ru\/catalog\/goryachee$/);
    await expect(h1(page)).toHaveText("Горячее");
    await expect(cards(page).filter({ hasText: title })).toHaveCount(1);
    await page.getByRole("button", { name: "Каталог" }).click();
    const sheet = page.getByRole("dialog", { name: "Каталог" });
    await expect(sheet.locator('[aria-current="page"]')).toHaveText("Горячее");
    // Пустой раздел — бледный и не ссылка (ADR-0020); в CI «Заготовки» пусты.
    await expect(sheet.locator("[data-empty]").filter({ hasText: "Заготовки" })).toHaveCount(1);
    await expect(sheet.getByRole("link", { name: "Заготовки" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Каталог" })).toBeFocused();
    await expectPhoneFriendly(page);

    // Главная: «Новые рецепты», свежий — первым.
    await page.goto("/ru");
    await expect(page.getByRole("heading", { name: "Новые рецепты" })).toBeVisible();
    await expect(cards(page).first()).toContainText(title);
    await expectPhoneFriendly(page);

    // Поиск по ингредиенту: состояние в адресе, после перезагрузки — то же.
    await page.goto("/ru/search", { waitUntil: "networkidle" });
    await expectNoindex(page);
    await page.getByRole("radio", { name: "По ингредиенту" }).click();
    await page.getByRole("textbox", { name: "Найти ингредиент" }).fill("фар");
    await page.getByRole("row", { name: "Фарш" }).click();
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await expect(page).toHaveURL(/by=ingredient.*i=%D0%A4%D0%B0%D1%80%D1%88/);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("row", { name: "Фарш" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await expectPhoneFriendly(page);
    // По названию — без учёта регистра; лупа в шапке на странице поиска сбрасывает поиск вместе с адресом.
    await page.getByRole("radio", { name: "По рецепту" }).click();
    await page.getByRole("textbox", { name: "Название рецепта" }).fill(title.toUpperCase());
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await expect(page).toHaveURL(/q=/);
    await page.getByRole("banner").getByRole("link", { name: "Поиск" }).click();
    await expect(page).toHaveURL(/\/ru\/search$/);
    await expect(page.getByRole("textbox", { name: "Название рецепта" })).toHaveValue("");

    // Правка в кабинете — на сайте сразу новое название по тому же адресу.
    await page.goto(`${cabinet}/edit`);
    const field = page.getByRole("textbox", { name: "Рецепт", exact: true });
    await field.fill((await field.inputValue()).replace(title, `${title} с сыром`));
    await page.getByRole("button", { name: "Разобрать" }).click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await page.waitForURL(cabinet);
    await page.goto(address);
    await expect(h1(page)).toHaveText(`${title} с сыром`);

    // Снять — исчез с главной и из раздела, адрес — страница 404 (noindex).
    await page.goto(cabinet);
    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
    await page.goto(address);
    await expect(h1(page)).toHaveText("Страница не найдена");
    await expectNoindex(page);
    await page.goto("/ru/catalog/goryachee");
    await expect(cards(page).filter({ hasText: title })).toHaveCount(0);
    await page.goto("/ru");
    await expect(cards(page).filter({ hasText: title })).toHaveCount(0);

    await page.goto(cabinet);
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Да, удалить" }).click();
    await page.waitForURL(/\/admin$/);
  });

  test("поиск: «Назад» возвращает туда, откуда пришли", async ({ page }) => {
    await page.goto("/ru/catalog/zagotovki", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Поиск" }).click();
    await page.waitForURL(/\/ru\/search$/);
    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page).toHaveURL(/\/ru\/catalog\/zagotovki$/);
  });

  test("пустой раздел по адресу — «Пока нет рецептов» и noindex; неизвестный — 404", async ({ page }) => {
    await page.goto("/ru/catalog/zagotovki");
    await expect(h1(page)).toHaveText("Заготовки");
    await expect(page.getByText("Пока нет рецептов — скоро появятся.")).toBeVisible();
    await expectNoindex(page);
    await expectPhoneFriendly(page);
    await page.goto("/ru/catalog/net-takogo-razdela");
    await expect(h1(page)).toHaveText("Страница не найдена");
    await expect(page.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/ru");
  });

  test("английская версия: шапка и надписи по-английски, кнопка языка ведёт на ту же страницу", async ({ page }) => {
    await page.goto("/en/catalog/preserves");
    await expect(h1(page)).toHaveText("Preserves");
    await expect(page.getByText("No recipes yet — coming soon.")).toBeVisible();
    await expectNoindex(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("banner").getByRole("link", { name: "Русский" })).toHaveAttribute("href", "/ru/catalog/zagotovki");
    await page.goto("/ru/catalog/zagotovki");
    await expect(page.getByRole("banner").getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/catalog/preserves");
    await page.goto("/en/search", { waitUntil: "networkidle" });
    await expect(h1(page)).toHaveText("Search");
    await expect(page.getByRole("radio", { name: "By ingredient" })).toBeVisible();
    await expectPhoneFriendly(page);
  });

  test("выбор языка кнопкой запоминается: английский браузер, нажали «Русский» — `/` ведёт на /ru", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await page.getByRole("banner").getByRole("link", { name: "Русский" }).click();
    await expect(page).toHaveURL(/\/ru$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await page.goto("/");
    await expect(page).toHaveURL(/\/ru$/);
    await page.getByRole("banner").getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });

  test("телефон 320 px: строка шапки помещается, без горизонтальной прокрутки", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ["/ru", "/ru/catalog/zagotovki", "/ru/search", "/en", "/en/search"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      const banner = page.getByRole("banner");
      const [name, search] = [
        await banner.getByRole("link", { name: /^(Книга рецептов Юлианы|Recipe Book Yuliana's)$/ }).boundingBox(),
        await banner.getByRole("link", { name: /^(Поиск|Search)$/ }).boundingBox(),
      ];
      if (!name || !search) throw new Error("нет названия или лупы");
      expect(name.x + name.width).toBeLessThanOrEqual(search.x);
      await expectSignature(page);
    }
  });

  test("логотип: подпись автора под названием, не касается кнопок и ленты; RU и EN на 320, 375 и 1280 px, axe", async ({ page }) => {
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/ru", "/en"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expectSignature(page);
        const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`), `${path} ${width}`).toEqual([]);
      }
    }
    await expect(page.locator("[data-logo-signature]")).toHaveText("Yuliana's");
  });

  test("иконка во вкладке: свой рисунок (SVG) и запасные ICO и значок для телефона", async ({ page, request }) => {
    await page.goto("/ru");
    await expect(page.locator('head link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
    for (const [path, type] of [["/icon.svg", "image/svg+xml"], ["/favicon.ico", "image/x-icon"], ["/apple-icon.png", "image/png"]] as const) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"], path).toContain(type);
    }
  });

  test("компьютер: шапка с лентой из 11 разделов не выше 150 px, axe; поиск — карточкой по центру @desktop", async ({ page }) => {
    for (const path of ["/ru", "/ru/catalog/zagotovki", "/ru/search"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const banner = page.getByRole("banner");
      await expect(banner.getByRole("navigation", { name: "Каталог" }).getByRole("listitem")).toHaveCount(11);
      expect((await banner.boundingBox())?.height ?? 999).toBeLessThanOrEqual(150);
      const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
    const card = await page.getByTestId("search-card").boundingBox();
    if (!card) throw new Error("нет карточки поиска");
    expect(Math.abs(card.x + card.width / 2 - 640)).toBeLessThan(20);
  });
});
