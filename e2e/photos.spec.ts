import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, type Page, expect, request as playwrightRequest, test } from "@playwright/test";
import sharp from "sharp";

import { TELEGRAM } from "./support/telegram";

// Фото блюда (план recipe-photos): снимок с телефона 4000×3000 (~5 МБ) уменьшается в браузере (прокси на проде
// пропускает ≤ 1 МБ) → окно кадрирования 4:3 → сохранить → кабинет и сайт (карточка, рецепт, og:image) → изменить кадр
// без повторного выбора → снять с публикации (фото пропадает) → убрать. Фикстура: слева красное, справа синее —
// по цвету готового файла видно, какой кадр вырезан.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — кабинет закрыт входом");

const KOTLETY = readFileSync("lib/domain/recipe-text/fixtures/kotlety.txt", "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const unique = () => Math.random().toString(36).slice(2, 7);

/** «Снимок с камеры»: шум (чтобы весил как настоящий), левая половина красная, правая — синяя; с `corners` — левый
 * нижний угол зелёный (видно поворот). */
async function cameraShot(width = 4000, height = 3000, corners = false): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const noise = (Math.random() - 0.5) * 60;
      const right = x >= width / 2;
      const green = corners && !right && y >= height / 2;
      pixels[i] = right || green ? 30 + noise : 220 + noise / 2;
      pixels[i + 1] = green ? 200 + noise / 2 : 30 + noise;
      pixels[i + 2] = right ? 220 + noise / 2 : 30 + noise;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

/** Цвет файла фото: red / blue / green — по средним каналам. */
async function colorOf(api: APIRequestContext, url: string, region?: { left: number; top: number; width: number; height: number }): Promise<string> {
  const response = await api.get(url);
  expect(response.status(), url).toBe(200);
  const body = await response.body();
  const part = region ? await sharp(body).extract(region).toBuffer() : body;
  const [r = 0, g = 0, b = 0] = (await sharp(part).stats()).channels.map((c) => c.mean);
  return r > b && r > g ? "red" : b > r && b > g ? "blue" : "green";
}

async function publish(page: Page, title: string): Promise<string> {
  await page.goto("/admin/recipes/new");
  await page.getByRole("textbox", { name: "Рецепт", exact: true }).fill(KOTLETY.replace("Мамины котлеты", title).replace("Подаём с пюре.", "Подаём с пюре. Основной — фарш."));
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL(/\/admin\/recipes\/[0-9a-f-]{36}$/);
  return page.url();
}

// Запрос от имени владельца — из самого браузера: cookie входа Secure, а API-клиент Playwright по http её не шлёт.
const ownerFetch = (page: Page, url: string) =>
  page.evaluate(async (target) => {
    const response = await fetch(target, { cache: "no-store" });
    return { status: response.status, cache: response.headers.get("cache-control") };
  }, url);

/** Кнопки, поля и строки меньше 44 px по высоте. Не считаются скрытые элементы и спрятанный `input[type=range]`
 * ползунка (его касаются по видимой дорожке высотой 44 px). */
const smallTargets = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href], [role="tab"], [role="row"], input, [tabindex="0"]'))
      .filter((el) => !(el instanceof HTMLInputElement && el.type === "range"))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 2 && rect.height > 2 && rect.height < 43.5)
      .map(({ el, rect }) => `${el.tagName} «${(el.textContent ?? "").trim().slice(0, 30)}» ${Math.round(rect.height)}px`),
  );

const photoSrc = async (page: Page) => (await page.getByRole("region", { name: "Фото блюда" }).locator("img").getAttribute("src")) ?? "";
const fileUrl = (src: string, file: string) => src.replace(/\/[^/]+$/, `/${file}`);

async function cropDrag(page: Page, dx: number) {
  const area = page.getByRole("group", { name: "Кадр фото" });
  const box = await area.boundingBox();
  if (!box) throw new Error("нет рамки");
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 5 });
  await page.mouse.move(x + dx, y, { steps: 5 });
  await page.mouse.up();
}

test("фото: уменьшить в браузере → кадр → сайт; изменить кадр; снять — фото пропадает; убрать", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const anonymous = await playwrightRequest.newContext({ baseURL });
  const cabinet = await publish(page, `Котлеты ${unique()}`);
  const block = page.getByRole("region", { name: "Фото блюда" });
  await expect(block.getByText("Фото пока нет")).toBeVisible();

  const shot = await cameraShot();
  expect(shot.length).toBeGreaterThan(1024 * 1024);
  const sizes: number[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && (req.postDataBuffer()?.length ?? 0) > 100_000) sizes.push(req.postDataBuffer()?.length ?? 0);
  });
  await block.getByLabel("Файл фото").setInputFiles({ name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: shot });
  const dialog = page.getByRole("dialog", { name: "Кадр для фото" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Кадр фото" })).toBeVisible();
  // axe — после анимации появления окна (fade-in 300 мс): посреди неё контраст «бледный» (№38).
  await page.waitForFunction(() => !document.querySelector("[data-entering]"));
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(AXE_TAGS).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);

  // Масштаб: колесо, «+/−», ползунок с клавиатуры (End — наибольший); затем сдвинуть фото влево до упора мышью —
  // в кадре только правая (синяя) половина.
  const zoom = dialog.getByRole("slider", { name: "Масштаб" });
  await dialog.getByRole("group", { name: "Кадр фото" }).hover();
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(1);
  await dialog.getByRole("button", { name: "Уменьшить" }).click();
  await dialog.getByRole("button", { name: "Увеличить" }).click();
  await zoom.focus();
  await page.keyboard.press("End");
  await expect(zoom).toHaveValue("2.5");
  await cropDrag(page, -600);
  const started = Date.now();
  await dialog.getByRole("button", { name: "Готово" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  test.info().annotations.push({ type: "время сохранения фото", description: `${Date.now() - started} мс` });
  await expect(page.getByText("Фото сохранено.")).toBeVisible();
  // Весь запрос (multipart Server Action) — меньше 1 МБ: так его пропустит прокси.
  expect(Math.max(...sizes)).toBeLessThan(1024 * 1024);

  const first = await photoSrc(page);
  expect(first).toMatch(/^\/media\/recipe\/[0-9a-f-]{36}\/960\.webp$/);
  expect(await colorOf(page.request, fileUrl(first, "480.webp"))).toBe("blue");
  const og = await anonymous.get(fileUrl(first, "og.jpg"));
  expect(og.status()).toBe(200);
  const ogMeta = await sharp(await og.body()).metadata();
  expect([ogMeta.format, ogMeta.width, ogMeta.height, ogMeta.exif]).toEqual(["jpeg", 1200, 630, undefined]);
  expect(og.headers()["cache-control"]).toBe("public, max-age=30, must-revalidate");
  const etag = og.headers().etag ?? "";
  expect((await anonymous.get(fileUrl(first, "og.jpg"), { headers: { "if-none-match": etag } })).status()).toBe(304);
  // Исходник — только владельцу.
  expect((await anonymous.get(fileUrl(first, "source.jpg"))).status()).toBe(404);
  expect(await ownerFetch(page, fileUrl(first, "source.jpg"))).toEqual({ status: 200, cache: "private, no-store" });

  // На сайте: страница рецепта (фото, og:image) и карточка на главной.
  await page.getByRole("link", { name: "Открыть на сайте" }).click();
  await page.waitForURL(/\/ru\/recipe\//);
  const address = page.url();
  await expect(page.locator("main img").first()).toHaveAttribute("srcset", /480\.webp 480w/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\.jpg$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.goto("/ru");
  await expect(page.locator("main:visible ul > li > a img").first()).toHaveAttribute("src", first);

  // Изменить кадр — без повторного выбора: стрелками сдвинуть фото вправо до упора → красная половина; старый адрес — 404.
  await page.goto(cabinet);
  await block.getByRole("button", { name: "Изменить кадр" }).click();
  await expect(dialog).toBeVisible();
  // Окно открылось с прежней рамкой — тем же увеличением.
  expect(Number(await dialog.getByRole("slider", { name: "Масштаб" }).inputValue())).toBeCloseTo(2.5, 1);
  await dialog.getByRole("group", { name: "Кадр фото" }).focus();
  for (let i = 0; i < 60; i += 1) await page.keyboard.press("ArrowRight");
  await dialog.getByRole("button", { name: "Готово" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect.poll(() => photoSrc(page)).not.toBe(first);
  const second = await photoSrc(page);
  expect(await colorOf(page.request, fileUrl(second, "480.webp"))).toBe("red");
  expect((await anonymous.get(fileUrl(first, "480.webp"))).status()).toBe(404);

  // «Отмена» и Esc ничего не меняют, фокус возвращается на кнопку.
  const recrop = block.getByRole("button", { name: "Изменить кадр" });
  await recrop.click();
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
  await recrop.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(recrop).toBeFocused();
  expect(await photoSrc(page)).toBe(second);
  expect(await smallTargets(page)).toEqual([]);

  // Заменить фото — новое фото и новый адрес, прежний — 404.
  await block.getByLabel("Файл фото").setInputFiles({ name: "IMG_0003.jpg", mimeType: "image/jpeg", buffer: await cameraShot(1600, 1200) });
  await dialog.getByRole("button", { name: "Готово" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect.poll(() => photoSrc(page)).not.toBe(second);
  expect((await anonymous.get(fileUrl(second, "480.webp"))).status()).toBe(404);
  const third = await photoSrc(page);

  // Снять с публикации — фото посторонним 404, владельцу видно; опубликовать снова — снова всем.
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
  expect((await anonymous.get(fileUrl(third, "480.webp"))).status()).toBe(404);
  expect(await ownerFetch(page, fileUrl(third, "480.webp"))).toEqual({ status: 200, cache: "private, no-store" });
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByRole("button", { name: "Снять с публикации" })).toBeVisible();
  expect((await anonymous.get(fileUrl(third, "480.webp"))).status()).toBe(200);
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();

  // Убрать — подтверждение (фокус на «Отмена»), заглушка; удалить черновик.
  await block.getByRole("button", { name: "Убрать фото" }).click();
  await expect(page.getByRole("button", { name: "Отмена" })).toBeFocused();
  await page.getByRole("button", { name: "Да, убрать" }).click();
  await expect(block.getByText("Фото пока нет")).toBeVisible();
  expect((await ownerFetch(page, fileUrl(third, "480.webp"))).status).toBe(404);
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
  await page.goto(address);
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("Страница не найдена");
  await anonymous.dispose();
});

test("фото: повёрнутое камерой (EXIF 6) стоит правильно; не картинка — понятная ошибка", async ({ page }) => {
  test.setTimeout(90_000);
  await publish(page, `Котлеты ${unique()}`);
  const block = page.getByRole("region", { name: "Фото блюда" });
  // Хранится «лёжа на боку» (повёрнуто на 90° против часовой), камера пометила: показывать с поворотом по часовой.
  const upright = await cameraShot(1600, 1200, true);
  const lying = await sharp(upright).rotate(270).toBuffer();
  const tagged = await sharp(lying).withMetadata({ orientation: 6 }).jpeg({ quality: 92 }).toBuffer();
  await block.getByLabel("Файл фото").setInputFiles({ name: "IMG_0002.jpg", mimeType: "image/jpeg", buffer: tagged });
  const dialog = page.getByRole("dialog", { name: "Кадр для фото" });
  await dialog.getByRole("button", { name: "Готово" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  const src = await photoSrc(page);
  // Как в эталоне: слева сверху красное, справа синее, слева снизу зелёное.
  expect(await colorOf(page.request, fileUrl(src, "480.webp"), { left: 10, top: 10, width: 40, height: 40 })).toBe("red");
  expect(await colorOf(page.request, fileUrl(src, "480.webp"), { left: 430, top: 10, width: 40, height: 40 })).toBe("blue");
  expect(await colorOf(page.request, fileUrl(src, "480.webp"), { left: 10, top: 310, width: 40, height: 40 })).toBe("green");

  await block.getByLabel("Файл фото").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("не фото") });
  await expect(block.getByText("Не получилось открыть фото")).toBeVisible();
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
});

test("фото на компьютере: окно кадрирования и страница рецепта без прокрутки вбок, axe @desktop", async ({ page }) => {
  test.setTimeout(90_000);
  const cabinet = await publish(page, `Котлеты ${unique()}`);
  const block = page.getByRole("region", { name: "Фото блюда" });
  await block.getByLabel("Файл фото").setInputFiles({ name: "IMG_0004.jpg", mimeType: "image/jpeg", buffer: await cameraShot(2400, 1600) });
  const dialog = page.getByRole("dialog", { name: "Кадр для фото" });
  const area = await dialog.getByRole("group", { name: "Кадр фото" }).boundingBox();
  // Рамка 4:3 и окно целиком на экране.
  expect(area && Math.abs(area.width / area.height - 4 / 3)).toBeLessThan(0.02);
  const box = await dialog.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(800);
  // axe — после анимации появления окна (fade-in 300 мс): посреди неё контраст «бледный» (№38).
  await page.waitForFunction(() => !document.querySelector("[data-entering]"));
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(AXE_TAGS).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await dialog.getByRole("button", { name: "Готово" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await page.getByRole("link", { name: "Открыть на сайте" }).click();
  await page.waitForURL(/\/ru\/recipe\//);
  await page.waitForLoadState("networkidle");
  // На компьютере браузер берёт крупный вариант (naturalWidth у srcset пересчитан под `sizes` — смотрим currentSrc).
  const photo = page.locator("main img").first();
  expect(await photo.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\/(960|1600)\.webp$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const pageAxe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(pageAxe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.goto(cabinet);
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await page.waitForURL(/\/admin$/);
});
