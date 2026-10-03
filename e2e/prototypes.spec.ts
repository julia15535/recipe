import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { TELEGRAM } from "./support/telegram";

// Пробные экраны (планы home-and-recipe-screens, screens-owner-feedback): каталог с 11 местами (пустые —
// бледные, ADR-0020), поиск за лупой, строка «время + цветные теги» и «~ N порций» (ADR-0021), пересчёт
// от основного ингредиента (ADR-0016). Тесты с меткой @desktop идут на 1280 px, остальные — на 375 px.
// Пробные экраны закрыты входом владельца — нужна сессия из e2e/auth.setup.ts.
test.skip(!TELEGRAM.enabled, "нет E2E_TELEGRAM_WEBHOOK_SECRET — пробные экраны закрыты входом");

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

// Цели касания меньше 44 px среди видимых кнопок, ссылок, «таблеток» и полей (как в design.spec);
// 1-пиксельные кнопки «закрыть» для экранного диктора у React Aria — не цели касания, их пропускаем.
const smallTargets = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href], [role="tab"], [role="row"], input'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 2 && rect.height > 2 && rect.height < 43.5)
      .map(({ el, rect }) => `${el.tagName} «${(el.textContent ?? "").trim().slice(0, 30)}» ${Math.round(rect.height)}px`),
  );

const ingredientRow = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
const servingsCard = (page: Page) => page.locator('[data-testid="servings"]:visible');

// :visible — Next 16 держит прошлую страницу скрытой после перехода (для «назад»), CSS-выборка видит и её.
const recipeCards = (page: Page) => page.locator("main ul li a[href^='/admin/ui/recipe/']:visible");

// Контраст текста пустого раздела к фону ленты/листа (axe такие места не проверит за нас).
const textContrast = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r = 0, g = 0, b = 0]: number[]) => {
      const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bgEl: Element | null = el;
    while (bgEl && getComputedStyle(bgEl).backgroundColor === "rgba(0, 0, 0, 0)") bgEl = bgEl.parentElement;
    const [fg, bg] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(getComputedStyle(bgEl ?? document.body).backgroundColor))];
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });

test.describe("пробные экраны — телефон", () => {
  test("главная: лупа ведёт в поиск", async ({ page }) => {
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Поиск" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/search$/);
    await expect(page.getByRole("radio", { name: "По рецепту" })).toBeChecked();
  });

  test("главная: «Каталог» открывает нижний лист; Esc, «Закрыть» и фон закрывают, фокус возвращается", async ({ page }) => {
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    await expect(page.getByRole("navigation", { name: "Каталог" })).toBeHidden();
    const trigger = page.getByRole("button", { name: "Каталог" });
    const sheet = page.getByRole("dialog", { name: "Каталог" });

    await trigger.click();
    await expect(sheet.getByRole("link")).toHaveCount(10);
    await expect(sheet.locator("[data-empty]")).toHaveText([/Заготовки\s*Пока нет рецептов/]);
    // Контраст проверяем после плавного появления листа (во время анимации цвета полупрозрачные).
    await page.waitForFunction(() => !document.querySelector("[data-entering]"));
    await expectNoAxeViolations(page);
    expect(await smallTargets(page)).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await sheet.getByRole("button", { name: "Закрыть" }).click();
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(sheet).toBeVisible();
    await page.waitForFunction(() => !document.querySelector("[data-entering]"));
    // Касание фона над листом (фон — подложка окна, у неё нет своей роли).
    const sheetBox = await sheet.boundingBox();
    if (!sheetBox) throw new Error("нет листа каталога");
    await page.mouse.click(187, Math.max(5, sheetBox.y - 20));
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await sheet.getByRole("link", { name: "Салаты" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/section\/salads$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Салаты");
    await expect(page.getByRole("navigation", { name: "Хлебные крошки" })).toHaveText(/Главная\s*\/\s*Салаты/);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(recipeCards(page)).toHaveCount(2);

    await page.getByRole("button", { name: "Каталог" }).click();
    await expect(sheet.locator('[aria-current="page"]')).toHaveText("Салаты");
    await expect(sheet.getByRole("link", { name: "Салаты" })).toHaveCount(0);
  });

  test("поиск: по ингредиенту, уточнение, два пустых состояния, «назад»", async ({ page }) => {
    await page.goto("/admin/ui/search", { waitUntil: "networkidle" });
    await expect(page.getByText("Начните вводить название")).toBeVisible();
    await page.getByRole("textbox", { name: "Название рецепта" }).fill("сыр");
    await expect(page.getByRole("link", { name: /Сырники со сметаной/ })).toBeVisible();
    await page.getByRole("textbox", { name: "Название рецепта" }).fill("");

    await page.getByRole("radio", { name: "По ингредиенту" }).click();
    await page.getByRole("row", { name: "Грибы" }).click();
    await expect(page.getByText("Нашлось: 2")).toBeVisible();
    await expect(page.getByRole("row", { name: "Белок", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Уточнить" }).click();
    expect(await smallTargets(page)).toEqual([]);
    await expectNoAxeViolations(page);
    await page.getByRole("row", { name: "Белок", exact: true }).click();
    await expect(page.getByRole("button", { name: "Уточнить · 1" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Ничего не нашлось")).toBeVisible();
    await page.getByRole("button", { name: "Сбросить поиск" }).click();
    await expect(page.getByText("Начните вводить название")).toBeVisible();

    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/home$/);
  });

  test("поиск: «Назад» возвращает туда, откуда пришли", async ({ page }) => {
    await page.goto("/admin/ui/recipe/bliny", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Поиск" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/search$/);
    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/recipe\/bliny$/);
  });

  test("рецепт: своё количество основного ингредиента пересчитывает остальное и «~ N порций»", async ({ page }) => {
    await page.goto("/admin/ui/recipe/syrniki", { waitUntil: "networkidle" });
    await expect(page.getByRole("navigation", { name: "Разделы каталога" }).getByRole("link")).toHaveText(["Завтраки"]);
    await expect(page.getByRole("button", { name: /порци/i })).toHaveCount(0);
    await expect(page.getByText("Отмечено автором")).toHaveCount(0);
    await expect(page.getByText("Особенности состава")).toHaveCount(0);
    await expect(page.getByTestId("recipe-meta")).toHaveText(/25 мин\s*Белок/);
    await expect(page.locator('[data-testid="servings"]')).toHaveCount(1);
    await expect(servingsCard(page)).toHaveText("~ примерно 4 порции");
    await expect(servingsCard(page).locator('[aria-hidden="true"]')).toHaveText("~");

    const input = page.getByRole("textbox", { name: "Творог 5%" });
    await expect(input).toHaveAttribute("inputmode", "decimal");
    await input.fill("220");
    await expect(servingsCard(page)).toContainText("1,8 порции");
    await input.fill("250");
    await expect(ingredientRow(page, "Мука")).toContainText("30 г");
    await expect(servingsCard(page)).toContainText("2 порции");

    await input.fill("");
    await expect(page.getByText("Впишите количество")).toBeVisible();
    await expect(servingsCard(page)).toContainText("2 порции");
    await input.fill("0");
    await expect(page.getByText("Количество должно быть больше нуля")).toBeVisible();

    await page.getByRole("button", { name: /Как в рецепте/ }).click();
    await expect(input).toHaveValue("500");
    await expect(servingsCard(page)).toContainText("4 порции");
  });

  test("рецепт: дробное количество — и с запятой, и с точкой", async ({ page }) => {
    await page.goto("/admin/ui/recipe/lemonade", { waitUntil: "networkidle" });
    const input = page.getByRole("textbox", { name: "Лимоны" });
    for (const value of ["1,5", "1.5"]) {
      await input.fill(value);
      await expect(servingsCard(page)).toContainText("3 порции");
      await expect(ingredientRow(page, "Сахар")).toContainText("40 г");
    }
  });
});

test.describe("первый рецепт владельца — вафли из творога", () => {
  test("версия 2: без описания и выхода, «щепотка» и «по желанию» без чисел, молоко с пометкой — и пересчёт", async ({ page }) => {
    await page.goto("/admin/ui/recipe/vafli-iz-tvoroga", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Творожные вафли");
    await expect(page.getByTestId("recipe-meta")).toHaveText("Белок");
    await expect(page.getByTestId("recipe-meta").locator("svg")).toHaveCount(0);
    await expect(page.locator('[data-testid="servings"]')).toHaveCount(0);
    await expect(page.getByText("Несладкие творожные вафли")).toHaveCount(0);
    const amount = (name: string) => ingredientRow(page, name).getByTestId("ingredient-amount");
    // Разрыхлитель и масло — дробью, как у владельца («½»), и после пересчёта (ADR-0032); у остальных демо-строк вид не задан.
    await expect(amount("Разрыхлитель")).toHaveText("1/2 ч. л.");
    await expect(amount("Соль")).toHaveText("щепотка");
    await expect(amount("Чёрный перец")).toHaveText("по желанию");
    await expect(amount("Растительное масло")).toHaveText("1/2 ст. л.");
    await expect(amount("Молоко")).toHaveText("1 ст. л., если творог сухой");
    await expectNoAxeViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    const input = page.getByRole("textbox", { name: "Творог 0,5%" });
    // Пересчёт округляется (ADR-0026, `lib/domain/rounding.ts`) и помечается ≈; основной — как ввели.
    await input.fill("300");
    await expect(amount("Яйца")).toHaveText("≈ 2 шт.");
    await expect(amount("Цельнозерновая мука")).toHaveText("≈ 55 г");
    await expect(amount("Разрыхлитель")).toHaveText("≈ 1/2 ч. л.");
    await expect(amount("Растительное масло")).toHaveText("≈ 1/2 ст. л.");
    await expect(amount("Молоко")).toHaveText("≈ 1 ст. л., если творог сухой");
    await expect(amount("Соль")).toHaveText("щепотка");

    await input.fill("550");
    await expect(amount("Яйца")).toHaveText("≈ 4 шт.");
    await expect(amount("Цельнозерновая мука")).toHaveText("≈ 100 г");
    await expect(amount("Разрыхлитель")).toHaveText("≈ 1 ч. л.");
    await expect(amount("Чёрный перец")).toHaveText("по желанию");
    await expect(amount("Растительное масло")).toHaveText("≈ 1 ст. л.");
    await expect(amount("Молоко")).toHaveText("≈ 2 ст. л., если творог сухой");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await input.fill("137,5");
    await expect(amount("Яйца")).toHaveText("≈ 1 шт.");
    await expect(amount("Разрыхлитель")).toHaveText("≈ 1/4 ч. л.");
    await expect(amount("Растительное масло")).toHaveText("≈ 3/4 ч. л.");
    await expect(amount("Молоко")).toHaveText("≈ 0,5 ст. л., если творог сухой");

    // Меньше 1 яйца — граммами с подсказкой (King Arthur: яйцо ≈ 50 г).
    await input.fill("40");
    await expect(amount("Яйца")).toHaveText("≈ 15 г, слегка перемешайте яйца и отвесьте");

    await page.getByRole("button", { name: /Как в рецепте/ }).click();
    await expect(amount("Яйца")).toHaveText("2 шт.");
    await expect(amount("Разрыхлитель")).toHaveText("1/2 ч. л.");
  });

  test("основной ингредиент — название слева, как у остальных, поле рядом в одной строке", async ({ page }) => {
    for (const [width, slug, main, other] of [
      [375, "lemonade", "Лимоны", "Сахар"],
      [1280, "lemonade", "Лимоны", "Сахар"],
      [375, "vafli-iz-tvoroga", "Творог 0,5%", "Яйца"],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/admin/ui/recipe/${slug}`, { waitUntil: "networkidle" });
      const name = page.getByText(main, { exact: true });
      const input = page.getByRole("textbox", { name: main });
      const [nameBox, inputBox, sugarBox] = await Promise.all([
        name.boundingBox(),
        input.boundingBox(),
        ingredientRow(page, other).getByText(other, { exact: true }).boundingBox(),
      ]);
      if (!nameBox || !inputBox || !sugarBox) throw new Error("нет названия, поля или строки «Сахар»");
      expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(inputBox.x);
      expect(Math.abs(nameBox.y + nameBox.height / 2 - (inputBox.y + inputBox.height / 2))).toBeLessThan(6);
      expect(Math.abs(nameBox.x - sugarBox.x)).toBeLessThan(2);
      const style = (el: Element) => [getComputedStyle(el).fontSize, getComputedStyle(el).fontWeight, getComputedStyle(el).color].join();
      const styles = await Promise.all([name, ingredientRow(page, other).getByText(other, { exact: true })].map((l) => l.evaluate(style)));
      expect(styles[0]).toBe(styles[1]);
    }
  });

  test("вафли — в «Завтраках» и в поиске по ингредиенту «Творог»", async ({ page }) => {
    await page.goto("/admin/ui/section/breakfast", { waitUntil: "networkidle" });
    await expect(recipeCards(page).filter({ hasText: "Творожные вафли" })).toHaveCount(1);
    await page.goto("/admin/ui/search", { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: "По ингредиенту" }).click();
    await page.getByRole("row", { name: "Творог" }).click();
    await expect(page.getByRole("link", { name: /Творожные вафли/ })).toBeVisible();
  });

  test("карточка: под названием время и один тег — первый у автора; без времени — тег, без тегов — время", async ({ page }) => {
    await page.goto("/admin/ui/section/breakfast", { waitUntil: "networkidle" });
    const card = (title: string) => recipeCards(page).filter({ hasText: title });
    await expect(card("Творожные вафли").locator("[data-tag]")).toHaveText(["Белок"]);
    await expect(card("Творожные вафли")).not.toContainText("мин");
    await expect(card("Омлет с овощами").locator("[data-tag]")).toHaveText(["Белок"]);
    await expect(card("Омлет с овощами")).toContainText("15 мин");
    await expect(card("Тонкие блины на молоке").locator("[data-tag]")).toHaveCount(0);
    await expect(card("Тонкие блины на молоке")).toContainText("40 мин");
    await expectNoAxeViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // У салата с тыквой «Полезные жиры» первые у автора (в каталоге — третьи); время + длинный тег помещаются;
    // тег входит в название ссылки.
    await page.goto("/admin/ui/section/salads", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Салат с тыквой и нутом.*35 мин.*Полезные жиры/ })).toBeVisible();
    await expect(card("Салат с тыквой и нутом").locator("[data-tag]")).toHaveText(["Полезные жиры"]);
    await expect(card("Боул с лососем, киноа и авокадо").locator("[data-tag]")).toHaveText(["Белок"]);
    await expectNoAxeViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("пробные экраны — страница раздела и закреплённая шапка", () => {
  test("раздел над названием рецепта открывает страницу раздела сразу с рецептами", async ({ page }) => {
    await page.goto("/admin/ui/recipe/bowl", { waitUntil: "networkidle" });
    await page.getByRole("navigation", { name: "Разделы каталога" }).getByRole("link", { name: "Горячее" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/section\/hot$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Горячее");
    await expect(recipeCards(page).getByRole("heading")).toHaveText([
      "Омлет с овощами",
      "Боул с лососем, киноа и авокадо",
      "Курица с травами",
      "Гречка с грибами и луком",
    ]);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("пустой раздел по адресу — «Пока нет рецептов», неизвестный — 404", async ({ page }) => {
    await page.goto("/admin/ui/section/preserves", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Заготовки");
    await expect(page.getByText("Пока нет рецептов — скоро появятся.")).toBeVisible();
    await expect(recipeCards(page)).toHaveCount(0);
    // Текущий и пустой одновременно — показывается как текущий.
    await page.getByRole("button", { name: "Каталог" }).click();
    await expect(page.getByRole("dialog", { name: "Каталог" }).locator('[aria-current="page"]')).toHaveText("Заготовки");
    await page.keyboard.press("Escape");
    // Кабинет отдаётся потоком (CSP с nonce) — notFound() приходит после заголовков, код 200.
    await page.goto("/admin/ui/section/no-such-section");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Такой страницы в кабинете нет");
  });

  test("старый выбор «Рецептов: 0» в браузере больше не прячет рецепты; переключателя нет", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("recipe-demo-mode", "none"));
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    await expect(page.getByText("Подборка недели")).toBeVisible();
    await expect(page.getByRole("radio", { name: /рецепт/i })).toHaveCount(0);
    await expect(page.getByText("Рецептов:")).toHaveCount(0);
    await page.goto("/admin/ui/search?section=soups", { waitUntil: "networkidle" });
    await expect(page.getByText("Рецептов:")).toHaveCount(0);
    await expect(page.getByText("Нашлось: 1")).toBeVisible();
  });

  test("шапка остаётся вверху при прокрутке; лист каталога — поверх неё; фокус не под шапкой", async ({ page }) => {
    await page.goto("/admin/ui/search", { waitUntil: "networkidle" });
    await expect(page.getByRole("banner")).toBeVisible();
    for (const path of ["/admin/ui/section/hot", "/admin/ui/recipe/syrniki"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.mouse.wheel(0, 1500);
      await expect.poll(async () => (await page.getByRole("banner").boundingBox())?.y).toBe(0);
    }
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    const header = page.getByRole("banner");
    await page.mouse.wheel(0, 1500);
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);

    const firstCard = recipeCards(page).first();
    await firstCard.focus();
    const [headerBox, cardBox] = [await header.boundingBox(), await firstCard.boundingBox()];
    if (!headerBox || !cardBox) throw new Error("нет шапки или карточки");
    expect(cardBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);

    // Прокрутить чуть дальше полоски «Пробный экран» — шапка уже прилипла, кнопка «Каталог» видна под ней.
    await page.evaluate(() => window.scrollTo(0, 0));
    const barHeight = await header.evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate((y) => window.scrollTo(0, y), barHeight + 4);
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
    const trigger = page.getByRole("button", { name: "Каталог" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Каталог" })).toBeVisible();
    expect(await page.evaluate(() => document.elementFromPoint(20, 20)?.closest("header") ?? null)).toBeNull();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test("поиск: уточнение — только разделы с рецептами; пустой раздел из адреса не применяется", async ({ page }) => {
    await page.goto("/admin/ui/search?section=preserves", { waitUntil: "networkidle" });
    await expect(page.getByText("Раздел «Заготовки» пока пуст — выберите другой или начните поиск.")).toBeVisible();
    await expect(page.getByText("Начните вводить название")).toBeVisible();
    await page.getByRole("button", { name: "Уточнить" }).click();
    const rows = page.getByRole("grid", { name: "Раздел" }).getByRole("row");
    await expect(rows).toHaveCount(10);
    await expect(rows.filter({ hasText: "Заготовки" })).toHaveCount(0);
  });
});

test.describe("шапка с каталогом (владелец: «шапка это вот это»)", () => {
  test("телефон: каталог — значок «меню» слева от названия в строке шапки", async ({ page }) => {
    await page.goto("/admin/ui/recipe/bowl", { waitUntil: "networkidle" });
    const banner = page.getByRole("banner");
    const menu = banner.getByRole("button", { name: "Каталог" });
    const title = banner.getByRole("link", { name: "Книга рецептов Юлианы" });
    const [menuBox, titleBox] = [await menu.boundingBox(), await title.boundingBox()];
    if (!menuBox || !titleBox) throw new Error("нет значка меню или названия");
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(titleBox.x);
    expect(Math.abs(menuBox.y + menuBox.height / 2 - (titleBox.y + titleBox.height / 2))).toBeLessThan(4);
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Каталог" }).getByRole("link")).toHaveCount(10);
  });

  test("высота шапки совпадает с --site-header-height (от неё отступ при прокрутке к фокусу)", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/admin/ui/recipe/bowl", { waitUntil: "networkidle" });
      const [height, variable] = await page.getByRole("banner").evaluate((el) => [
        el.getBoundingClientRect().height,
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-header-height")) * 16,
      ]);
      expect(Math.abs(height - variable)).toBeLessThanOrEqual(1);
    }
  });

  test("телефон 320 px: строка шапки помещается, без горизонтальной прокрутки", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ["/admin/ui/home", "/admin/ui/recipe/bowl", "/admin/ui/section/soups", "/admin/ui/search"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(await smallTargets(page)).toEqual([]);
      const banner = page.getByRole("banner");
      const title = await banner.getByRole("link", { name: "Книга рецептов Юлианы" }).boundingBox();
      const search = await banner.getByRole("link", { name: "Поиск" }).boundingBox();
      if (!title || !search) throw new Error("нет названия или лупы");
      expect(title.x + title.width).toBeLessThanOrEqual(search.x);
      // Логотип в две строки (название и подпись, ADR-0033) — в пределах строки шапки 72 px.
      expect(title.height).toBeLessThanOrEqual(72);
    }
  });

  test("компьютер: шапка с лентой на всех экранах, закреплена и не выше 150 px @desktop", async ({ page }) => {
    // Длинные страницы — проверяем «залипание»; короткие (раздел, поиск) на 1280 px не прокручиваются.
    for (const path of ["/admin/ui/home", "/admin/ui/recipe/bowl"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const banner = page.getByRole("banner");
      await page.mouse.wheel(0, 1500);
      await expect.poll(async () => (await banner.boundingBox())?.y).toBe(0);
      await expect(banner.getByRole("navigation", { name: "Каталог" })).toBeInViewport();
      expect((await banner.boundingBox())?.height).toBeLessThanOrEqual(150);
    }
    for (const path of ["/admin/ui/section/hot", "/admin/ui/search"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.getByRole("banner").getByRole("navigation", { name: "Каталог" })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("button", { name: "Каталог" })).toBeHidden();
    }
  });
});

test.describe("пробные экраны — компьютер", () => {
  test("главная: каталог — 11 мест одной лентой на всю ширину, пустые не ссылки @desktop", async ({ page }) => {
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    const ribbon = page.getByRole("navigation", { name: "Каталог" });
    const places = ribbon.getByRole("listitem");
    await expect(places).toHaveCount(11);
    await expect(ribbon.getByRole("link")).toHaveCount(10);
    const tops = await places.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    expect((await ribbon.boundingBox())?.width).toBe(1280);
    await expect(page.getByRole("button", { name: "Каталог" })).toBeHidden();
    await expect(ribbon.locator("[data-empty]")).toHaveText(["Заготовки, пока нет рецептов"]);
    expect(await textContrast(page, "nav [data-empty]")).toBeGreaterThanOrEqual(4.5);
    // Пустые места — не ссылки и не в порядке Tab.
    expect(await ribbon.locator("[data-empty]").evaluateAll((els) => els.filter((el) => (el as HTMLElement).tabIndex >= 0).length)).toBe(0);
    await expectNoAxeViolations(page);

    await page.mouse.wheel(0, 1200);
    await expect.poll(async () => (await page.getByRole("banner").boundingBox())?.y).toBe(0);
  });

  test("раздел: лента отмечает текущий раздел, рецепты сразу @desktop", async ({ page }) => {
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    const ribbon = page.getByRole("navigation", { name: "Каталог" });
    await ribbon.getByRole("link", { name: "Супы" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/section\/soups$/);
    await expect(ribbon.locator('[aria-current="page"]')).toHaveText("Супы");
    await expect(ribbon.getByRole("link")).toHaveCount(9);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Супы");
    await expect(recipeCards(page)).toHaveCount(1);
    await expectNoAxeViolations(page);
  });

  test("поиск: форма — карточка по центру, результаты под ней @desktop", async ({ page }) => {
    await page.goto("/admin/ui/search?section=salads", { waitUntil: "networkidle" });
    const card = await page.getByTestId("search-card").boundingBox();
    if (!card) throw new Error("нет карточки поиска");
    expect(Math.abs(card.x + card.width / 2 - 640)).toBeLessThanOrEqual(2);
    expect(card.width).toBeLessThanOrEqual(768);
    await expect(page.getByText("Нашлось: 2")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("рецепт: одна колонка, «~ N порций» у «Ингредиентов», у тегов свои цвета @desktop", async ({ page }) => {
    await page.goto("/admin/ui/recipe/bowl", { waitUntil: "networkidle" });
    await expect(page.getByRole("complementary")).toHaveCount(0);
    const heading = await page.getByRole("heading", { name: "Ингредиенты" }).boundingBox();
    const servings = await servingsCard(page).boundingBox();
    if (!heading || !servings) throw new Error("нет заголовка или порций");
    expect(servings.x).toBeGreaterThan(heading.x + heading.width);
    expect(Math.abs(servings.y + servings.height / 2 - (heading.y + heading.height / 2))).toBeLessThan(16);

    const colors = await page
      .getByRole("list", { name: "Особенности состава" })
      .locator("[data-tag]")
      .evaluateAll((els) => els.map((el) => [el.getAttribute("data-tag"), getComputedStyle(el).backgroundColor, getComputedStyle(el).color]));
    expect(colors).toEqual([
      ["protein", "rgb(255, 230, 214)", "rgb(138, 74, 34)"],
      ["fiber", "rgb(236, 240, 215)", "rgb(77, 91, 26)"],
      ["healthy-fats", "rgb(248, 236, 196)", "rgb(110, 84, 16)"],
      ["low-sugar", "rgb(227, 235, 242)", "rgb(52, 83, 110)"],
      ["iron", "rgb(243, 223, 232)", "rgb(122, 46, 82)"],
    ]);

    await page.getByRole("textbox", { name: "Лосось" }).fill("750");
    await expect(servingsCard(page)).toContainText("5 порций");
    await expectNoAxeViolations(page);
  });
});
