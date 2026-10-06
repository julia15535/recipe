// Замечания разбора: код — для тестов и экрана, текст — простыми словами для владельца.
export type IssueCode =
  | "text-empty"
  | "text-too-large"
  | "too-many-lines"
  | "line-too-long"
  | "control-chars"
  | "no-title"
  | "title-too-long"
  | "no-section"
  | "unknown-tag"
  | "no-ingredients"
  | "too-many-ingredients"
  | "ingredient-unparsed"
  | "ingredient-no-amount"
  | "ingredient-too-long"
  | "unknown-unit"
  | "no-main"
  | "many-main"
  | "main-not-exact"
  | "no-steps"
  | "too-many-steps"
  | "step-too-long"
  | "step-joined"
  | "too-many-tips"
  | "tip-too-long"
  | "yield-unparsed"
  | "yield-word";

export type Issue = { code: IssueCode; severity: "error" | "warning"; line: number | null; raw: string | null; message: string };

const WARNINGS = new Set<IssueCode>(["unknown-tag", "unknown-unit", "step-joined", "yield-unparsed", "yield-word", "no-main", "ingredient-no-amount"]);

const SECTION_HINT = "завтрак, суп, салат, горячее, гарнир, закуска, выпечка, десерт, соус, напиток или заготовка";

const MESSAGES: Record<IssueCode, (subject: string) => string> = {
  "text-empty": () => "Вставьте текст рецепта.",
  "text-too-large": () => "Текст слишком длинный — больше 20 КБ. Сократите его.",
  "too-many-lines": () => "Слишком много строк — больше 300.",
  "line-too-long": () => "Строка слишком длинная — больше 2000 знаков. Разбейте её.",
  "control-chars": () => "В строке есть невидимые служебные символы — перепечатайте её.",
  "no-title": () => "Нет названия: первая строка — название рецепта.",
  "title-too-long": () => "Название слишком длинное — не больше 120 знаков.",
  "no-section": () => `Не указан раздел. Добавьте строку «Теги: …» — ${SECTION_HINT}.`,
  "unknown-tag": (word) => `«${word}» — нет такого раздела или тега, пропущено. Разделы: ${SECTION_HINT}; теги: белок, клетчатка, полезные жиры, омега-3, мало сахара, железо, антиоксиданты.`,
  "no-ingredients": () => "Нет ингредиентов. Начните список строкой «Ингредиенты:».",
  "too-many-ingredients": () => "Слишком много ингредиентов — не больше 60.",
  "ingredient-unparsed": () => "Не получилось разобрать строку. Пример: «Творог — 275 г» или «Соль — по вкусу».",
  "ingredient-no-amount": (name) => `У «${name}» нет количества — на сайте будет без числа. Если нужно, допишите количество или «по вкусу».`,
  "ingredient-too-long": () => "Название или пометка ингредиента слишком длинные — сократите строку.",
  "unknown-unit": (unit) => `Единица «${unit}» оставлена как написана — при пересчёте слово не меняется.`,
  "no-main": () =>
    "Основной ингредиент не отмечен — рецепт будет без пересчёта. Чтобы посетитель мог пересчитать, допишите «основной» к нужной строке.",
  "many-main": () => "Основным отмечено несколько ингредиентов — оставьте одну пометку.",
  "main-not-exact": () => "У основного ингредиента нужно точное количество — не диапазон и не «по вкусу».",
  "no-steps": () => "Нет шагов приготовления. Начните их строкой «Приготовление:».",
  "too-many-steps": () => "Слишком много шагов — не больше 40.",
  "step-too-long": () => "Шаг слишком длинный — разбейте его на несколько.",
  "step-joined": () => "Строка без номера — добавлена к предыдущему шагу.",
  "too-many-tips": () => "Слишком много советов — не больше 20.",
  "tip-too-long": () => "Совет слишком длинный — не больше 1000 знаков, разбейте его.",
  "yield-unparsed": () => "Выход не распознан и пропущен. Пример: «Выход: 4 порции».",
  "yield-word": (word) => `Слово «${word}» при пересчёте не склоняется. Если нужно — напишите «4 шт.» или «4 порции».`,
};

export function issue(code: IssueCode, line: number | null = null, raw: string | null = null, subject = ""): Issue {
  return { code, severity: WARNINGS.has(code) ? "warning" : "error", line, raw, message: MESSAGES[code](subject) };
}
