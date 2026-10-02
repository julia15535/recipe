import { describe, expect, it } from "vitest";

import { fraction } from "../fraction";
import vafliV1 from "./fixtures/vafli-v1.txt?raw";
import vafliV2 from "./fixtures/vafli-v2.txt?raw";
import { parseRecipeText } from "./parse";
import { slugify } from "./slug";

// Золотые тексты — дословно строки 6–22 и 33–49 `.memory_bank/_intake/_processed/recipes/vafli-iz-tvoroga.md`.
const codes = (text: string) => parseRecipeText(text).issues.map((item) => `${item.severity}:${item.code}`);

describe("разбор текста владельца — вафли", () => {
  it("версия 2 разбирается целиком и без замечаний", () => {
    const result = parseRecipeText(vafliV2);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    const { draft } = result;
    expect(draft.title).toBe("Творожные вафли");
    expect(draft.sections).toEqual(["breakfast"]);
    expect(draft.tags).toEqual(["protein"]);
    expect(result.mainIndex).toBe(0);
    expect(draft.ingredients.map(({ name, unit, note }) => [name, unit, note])).toEqual([
      ["Творог 0,5%", "г", null],
      ["Яйца", "шт.", null],
      ["Цельнозерновая мука", "г", null],
      ["Разрыхлитель", "ч. л.", null],
      ["Соль", null, "щепотка"],
      ["Чёрный перец / итальянские травы / паприка", null, "по желанию"],
      ["Растительное масло", "ст. л.", null],
      ["Молоко", "ст. л.", "если творог сухой"],
    ]);
    expect(draft.ingredients[0]?.quantity).toEqual({ kind: "exact", amount: fraction(275) });
    expect(draft.ingredients[3]?.quantity).toEqual({ kind: "exact", amount: fraction(1, 2) });
    expect(draft.ingredients[6]?.quantity).toEqual({ kind: "exact", amount: fraction(1, 2) });
    expect(draft.steps).toEqual([
      "Творог разомни или пробей блендером.",
      "Добавь яйца, соль и специи.",
      "Всыпь цельнозерновую муку и разрыхлитель.",
      "Оставь на 5–7 минут, чтобы цельнозерновая мука впитала влагу.",
      "Разогрей вафельницу и выпекай 6-7 минут до румяной корочки.",
    ]);
    expect(slugify(draft.title)).toBe("tvorozhnye-vafli");
  });

  it("версия 1: диапазон ½–1 ч. л., название как в тексте", () => {
    const result = parseRecipeText(vafliV1);
    expect(result.ok).toBe(true);
    expect(result.draft.title).toBe("Рецепт вафель из творога");
    const powder = result.draft.ingredients.find((item) => item.name === "Разрыхлитель");
    expect(powder?.quantity).toEqual({ kind: "range", min: fraction(1, 2), max: fraction(1) });
    expect(result.draft.ingredients.find((item) => item.name === "Соль")?.quantity).toEqual({ kind: "exact", amount: fraction(1, 2) });
  });
});

describe("разбор текста — ошибки и предупреждения", () => {
  const base = "Сырники\nТеги: завтрак\nИнгредиенты:\n- Творог — 500 г - основной\n- Сахар — 2 ст. л.\nПриготовление:\n1. Смешать.";

  it("без основного — ошибка с подсказкой кандидата (его строка), но сохранение недоступно", () => {
    const result = parseRecipeText(base.replace(" - основной", ""));
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: "no-main", severity: "error", line: 4, raw: "- Творог — 500 г" });
    expect(result.issues[0]?.message).toContain("«Творог»");
  });

  it("два основных и основной-диапазон — ошибки; ингредиент без количества — ошибка со строкой", () => {
    const many = parseRecipeText(base.replace("2 ст. л.", "2 ст. л. - основной"));
    expect(many.issues.find((item) => item.code === "many-main")).toMatchObject({ line: 5, raw: "- Сахар — 2 ст. л. - основной" });
    const range = parseRecipeText(base.replace("500 г", "400–500 г"));
    expect(range.issues.find((item) => item.code === "main-not-exact")).toMatchObject({ line: 4, raw: "- Творог — 400–500 г - основной" });
    const unparsed = parseRecipeText(base.replace("- Сахар — 2 ст. л.", "- Сахар — немного"));
    expect(unparsed.issues.find((item) => item.code === "ingredient-unparsed")).toMatchObject({ line: 5, raw: "- Сахар — немного" });
    const noAmount = parseRecipeText(base.replace("- Сахар — 2 ст. л.", "- Соль"));
    expect(noAmount.issues.find((item) => item.code === "ingredient-no-amount")).toMatchObject({ line: 5, raw: "- Соль" });
  });

  it("нет раздела, шагов, ингредиентов; неизвестный тег — предупреждение", () => {
    expect(codes("Просто текст")).toEqual(["error:no-section", "error:no-ingredients", "error:no-steps"]);
    expect(codes(base.replace("завтрак", "завтрак, вкуснота"))).toEqual(["warning:unknown-tag"]);
  });

  it("оборванная строка шага (перенос PDF) приклеивается с предупреждением; советы — пока пропускаются", () => {
    const text = `${base.replace("1. Смешать.", "1. Смешать и")}\nобжарить.\nСоветы:\nПодавать со сметаной.`;
    expect(parseRecipeText(text).draft.steps).toEqual(["Смешать и обжарить."]);
    expect(codes(text)).toEqual(["warning:step-joined", "warning:tips-skipped"]);
  });

  it("шаги как пишет владелец: «1 — Текст» через пустую строку; без номеров — каждая строка шаг", () => {
    const owner = parseRecipeText(
      `${base.split("Приготовление:")[0]}Приготовление\n\n1 — Орехи выложить на противень и поставить в духовку на 7–8 минут. Также можно на сковороде.\n\n2 — Готовые орехи остудить и порубить.\n\n3 — Апельсин вымыть.`,
    );
    expect(owner.issues).toEqual([]);
    expect(owner.draft.steps).toEqual([
      "Орехи выложить на противень и поставить в духовку на 7–8 минут. Также можно на сковороде.",
      "Готовые орехи остудить и порубить.",
      "Апельсин вымыть.",
    ]);
    const plain = parseRecipeText(base.replace("1. Смешать.", "Смешать.\nОбжарить.\nПодать."));
    expect(plain.draft.steps).toEqual(["Смешать.", "Обжарить.", "Подать."]);
  });

  it("несколько шагов в одной строке и «Приготовление: 1. …» на строке заголовка", () => {
    const inline = parseRecipeText(base.replace("1. Смешать.", "1. Смешать творог. 2. Добавить 2 ст. л. сахара. 3) Жарить 3–4 минуты. 4 — Подать."));
    expect(inline.draft.steps).toEqual(["Смешать творог.", "Добавить 2 ст. л. сахара.", "Жарить 3–4 минуты.", "Подать."]);
    const sameLine = parseRecipeText(base.replace("Приготовление:\n1. Смешать.", "Приготовление: 1. Смешать.\n2. Жарить."));
    expect(sameLine.ok).toBe(true);
    expect(sameLine.draft.steps).toEqual(["Смешать.", "Жарить."]);
  });

  it("ингредиенты владельца без маркеров: «сода — 3/4 ч. л. (примерно 3 г)», «соль — на кончике ножа (…)»", () => {
    const result = parseRecipeText(
      base.replace("- Сахар — 2 ст. л.", "сода — 3/4 ч. л. (примерно 3 г)\nсоль — на кончике ножа (примерно 1 г)\nимбирь молотый — 1/2 ч. л. (примерно 1 г)"),
    );
    expect(result.ok).toBe(true);
    expect(result.draft.ingredients.slice(1).map(({ name, unit, note }) => [name, unit, note])).toEqual([
      ["Сода", "ч. л.", "примерно 3 г"],
      ["Соль", null, "на кончике ножа, примерно 1 г"],
      ["Имбирь молотый", "ч. л.", "примерно 1 г"],
    ]);
  });

  it("пределы: пусто, больше 20 КБ в байтах UTF-8 (эмодзи — 4 байта), служебные символы", () => {
    expect(codes("   ")).toEqual(["error:text-empty"]);
    expect(codes("🍰".repeat(5121))).toEqual(["error:text-too-large"]);
    expect(codes("🍰".repeat(5119)).includes("error:text-too-large")).toBe(false);
    expect(codes(base.replace("Смешать.", "Смешать.\u0007"))).toContain("error:control-chars");
  });

  it("пустых шагов и единиц не бывает: строка из маркера пропускается, «2, крупные» — без единицы", () => {
    const result = parseRecipeText(base.replace("1. Смешать.", "1. Смешать.\n●\n2. Пожарить.").replace("- Сахар — 2 ст. л.", "- Яйца — 2, крупные"));
    expect(result.ok).toBe(true);
    expect(result.draft.steps).toEqual(["Смешать.", "Пожарить."]);
    expect(result.draft.ingredients[1]).toMatchObject({ unit: null, note: "крупные" });
  });

  it("«Название:» не теряет первую строку шапки; «Время:» внутри шагов — это шаг", () => {
    const result = parseRecipeText(`Любимые сырники\nНазвание: Сырники\n${base.split("\n").slice(1).join("\n")}\nВремя приготовления: 30 минут`);
    expect(result.draft.title).toBe("Сырники");
    expect(result.draft.description).toBe("Любимые сырники");
    expect(result.draft.time).toBeNull();
    expect(result.draft.steps.at(-1)).toBe("Время приготовления: 30 минут");
    const long = parseRecipeText(`Сырники\nНазвание: ${"а".repeat(130)}\nТеги: завтрак`);
    expect(long.issues.find((item) => item.code === "title-too-long")?.line).toBe(2);
  });

  it("выход и XSS-строка — просто текст", () => {
    const result = parseRecipeText(base.replace("Теги: завтрак", "Теги: завтрак\nВыход: 4 порции\nОписание: <script>alert(1)</script>"));
    expect(result.draft.yield).toMatchObject({ amount: fraction(4) });
    expect(result.draft.description).toBe("<script>alert(1)</script>");
  });
});
