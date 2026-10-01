import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

// Пробные экраны (планы home-and-recipe-screens, screens-owner-feedback): каталог с 11 местами (пустые —
// бледные, ADR-0020), поиск за лупой, строка «время + цветные теги» и «~ N порций» (ADR-0021), пересчёт
// от основного ингредиента (ADR-0016). Тесты с меткой @desktop идут на 1280 px, остальные — на 375 px.
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

// Режим демо в полоске «Пробный экран»: все / первые 3 / ни одного рецепта.
const setDemoMode = (page: Page, name: "Все рецепты" | "Первые 3 рецепта" | "Ни одного рецепта") =>
  page.getByRole("radio", { name }).click();

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
    await page.mouse.click(187, 40);
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await sheet.getByRole("link", { name: "Салаты" }).click();
    await expect(page).toHaveURL(/\/admin\/ui\/search\?section=salads$/);
    await expect(page.getByRole("row", { name: "Салаты" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Нашлось: 2")).toBeVisible();
    await page.getByRole("row", { name: "Белок", exact: true }).click();
    await expect(page.getByRole("link", { name: /Салат с тыквой и нутом/ })).toBeVisible();
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

    await setDemoMode(page, "Ни одного рецепта");
    await expect(page.getByText("Рецепты скоро появятся")).toBeVisible();
    await expect(page.getByRole("row", { name: "Салаты" })).toHaveCount(0);
    await expect(page.getByRole("row", { name: "Белок", exact: true })).toBeVisible();
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
    await expect(servingsCard(page)).toContainText("4 порции");

    const input = page.getByRole("textbox", { name: "Творог 5%" });
    await expect(input).toHaveAttribute("inputmode", "decimal");
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

test.describe("пробные экраны — сколько рецептов (ADR-0020)", () => {
  test("лист каталога: «оживают» только разделы с рецептами; пустые — не ссылки", async ({ page }) => {
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    await setDemoMode(page, "Первые 3 рецепта");
    await page.getByRole("button", { name: "Каталог" }).click();
    const sheet = page.getByRole("dialog", { name: "Каталог" });
    await expect(sheet.getByRole("link")).toHaveText(["Завтраки", "Супы", "Горячее"]);
    await expect(sheet.locator("[data-empty]")).toHaveCount(8);
    await expect(sheet.getByText("Пока нет рецептов")).toHaveCount(8);
    expect(await textContrast(page, "[role=dialog] [data-empty] .text-lg")).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press("Escape");

    await setDemoMode(page, "Ни одного рецепта");
    await expect(page.getByText("Скоро здесь появятся рецепты")).toBeVisible();
    await expect(page.getByText("Подборка недели")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Популярное" })).toHaveCount(0);
    await page.getByRole("button", { name: "Каталог" }).click();
    await expect(sheet.getByRole("link")).toHaveCount(0);
    await expect(sheet.locator("[data-empty]")).toHaveCount(11);
  });

  test("поиск: уточнение — только разделы с рецептами; пустой раздел из адреса сбрасывается", async ({ page }) => {
    await page.goto("/admin/ui/search?section=preserves", { waitUntil: "networkidle" });
    await expect(page.getByText("Раздел «Заготовки» пока пуст — показываем все рецепты.")).toBeVisible();
    await expect(page.getByText("Начните вводить название")).toBeVisible();
    await setDemoMode(page, "Первые 3 рецепта");
    await page.getByRole("button", { name: "Уточнить" }).click();
    await expect(page.getByRole("grid", { name: "Раздел" }).getByRole("row")).toHaveText(["Завтраки", "Супы", "Горячее"]);
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
    await expectNoAxeViolations(page);

    await setDemoMode(page, "Ни одного рецепта");
    await expect(ribbon.getByRole("link")).toHaveCount(0);
    await expect(ribbon.locator("[data-empty]")).toHaveCount(11);
    await page.keyboard.press("Tab");
    await expect(page.locator("nav [data-empty]:focus")).toHaveCount(0);
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
