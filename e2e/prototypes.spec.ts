import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

// Пробные экраны (план home-and-recipe-screens): каталог, поиск за лупой, пересчёт от основного
// ингредиента (ADR-0016, ADR-0018). Тесты с меткой @desktop идут на 1280 px, остальные — на 375 px.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

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
    await expect(sheet.getByRole("link")).toHaveCount(11);
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
    await expect(page.getByText("Нашлось: 1")).toBeVisible();
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

    await page.getByRole("button", { name: "Как выглядит без рецептов" }).click();
    await expect(page.getByText("Рецепты скоро появятся")).toBeVisible();
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

  test("рецепт: своё количество основного ингредиента пересчитывает остальное и порции", async ({ page }) => {
    await page.goto("/admin/ui/recipe/syrniki", { waitUntil: "networkidle" });
    await expect(page.getByRole("navigation", { name: "Разделы каталога" }).getByRole("link")).toHaveText(["Завтраки"]);
    await expect(page.getByRole("button", { name: /порци/i })).toHaveCount(0);
    await expect(page.getByText("Отмечено автором по ингредиентам")).toBeVisible();
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

test.describe("пробные экраны — компьютер", () => {
  test("главная: каталог — одна лента на всю ширину @desktop", async ({ page }) => {
    await page.goto("/admin/ui/home", { waitUntil: "networkidle" });
    const ribbon = page.getByRole("navigation", { name: "Каталог" });
    const links = ribbon.getByRole("link");
    await expect(links).toHaveCount(11);
    const tops = await links.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    expect((await ribbon.boundingBox())?.width).toBe(1280);
    await expect(page.getByRole("button", { name: "Каталог" })).toBeHidden();
    await expectNoAxeViolations(page);
  });

  test("рецепт: порции — справа от вкладок и тоже пересчитываются @desktop", async ({ page }) => {
    await page.goto("/admin/ui/recipe/syrniki", { waitUntil: "networkidle" });
    const aside = page.getByRole("complementary", { name: "Порции" });
    const [asideBox, tabsBox] = await Promise.all([aside.boundingBox(), page.getByRole("tablist").boundingBox()]);
    if (!asideBox || !tabsBox) throw new Error("нет колонки порций или вкладок");
    expect(asideBox.x).toBeGreaterThan(tabsBox.x + tabsBox.width);

    await page.getByRole("textbox", { name: "Творог 5%" }).fill("750");
    await expect(aside).toContainText("6 порций");
    await expectNoAxeViolations(page);
  });
});
