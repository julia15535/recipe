import type { CompositionTag, SectionId } from "./demo-catalog";

// Примерные рецепты для прототипов. Первый раздел — основной (ADR-0018); main — индекс основного
// ингредиента, от которого считается пересчёт (ADR-0016); search — ключи поиска по ингредиенту.
export type DemoIngredient = { name: string; amount: number; unit: string };

export type DemoRecipe = {
  slug: string;
  title: string;
  description: string;
  sections: [SectionId, ...SectionId[]];
  composition: CompositionTag[];
  time: string;
  servings: number;
  tone: string;
  main: number;
  ingredients: DemoIngredient[];
  search: string[];
  steps: string[];
};

const ing = (name: string, amount: number, unit: string): DemoIngredient => ({ name, amount, unit });

export const RECIPES: DemoRecipe[] = [
  {
    slug: "syrniki", title: "Сырники со сметаной", description: "Нежные внутри, с хрустящей корочкой — к чаю или на завтрак.",
    sections: ["breakfast"], composition: ["Белок"], time: "25 мин", servings: 4, tone: "from-accent-200 to-accent-400", main: 0,
    ingredients: [ing("Творог 5%", 500, "г"), ing("Яйцо", 1, "шт."), ing("Мука", 60, "г"), ing("Сахар", 30, "г"), ing("Сметана к подаче", 100, "г")],
    search: ["Творог", "Яйца", "Мука", "Сметана"],
    steps: ["Разомните творог вилкой до однородности.", "Добавьте яйцо и сахар, перемешайте.", "Всыпьте муку и сформируйте небольшие шайбы.", "Обжарьте на среднем огне по 3–4 минуты с каждой стороны."],
  },
  {
    slug: "bliny", title: "Тонкие блины на молоке", description: "Кружевные и тонкие — со сметаной, вареньем или мёдом.",
    sections: ["breakfast", "baking"], composition: [], time: "40 мин", servings: 4, tone: "from-accent-100 to-accent-300", main: 0,
    ingredients: [ing("Молоко", 500, "мл"), ing("Яйцо", 2, "шт."), ing("Мука", 200, "г"), ing("Сахар", 20, "г"), ing("Соль", 3, "г"), ing("Масло растительное", 30, "мл")],
    search: ["Молоко", "Яйца", "Мука"],
    steps: ["Взбейте яйца с сахаром и солью.", "Влейте половину молока, всыпьте муку и размешайте до гладкости.", "Добавьте остальное молоко и масло, дайте тесту постоять 15 минут.", "Жарьте на горячей сковороде по минуте с каждой стороны."],
  },
  {
    slug: "omlet", title: "Омлет с овощами", description: "Пышный омлет с томатами и шпинатом — завтрак за 15 минут.",
    sections: ["breakfast", "hot"], composition: ["Белок", "Мало сахара"], time: "15 мин", servings: 2, tone: "from-brand-100 to-accent-200", main: 0,
    ingredients: [ing("Яйцо", 4, "шт."), ing("Молоко", 80, "мл"), ing("Помидор", 1, "шт."), ing("Шпинат", 40, "г"), ing("Масло сливочное", 10, "г")],
    search: ["Яйца", "Молоко", "Томаты"],
    steps: ["Взбейте яйца с молоком и щепоткой соли.", "Обжарьте нарезанный помидор и шпинат на масле 2 минуты.", "Залейте яйцами, накройте крышкой и готовьте 6–7 минут на слабом огне."],
  },
  {
    slug: "mushroom-soup", title: "Суп с белыми грибами", description: "Ароматный и наваристый — с картофелем и зеленью.",
    sections: ["soups"], composition: ["Клетчатка"], time: "1 ч", servings: 6, tone: "from-brand-200 to-brand-400", main: 0,
    ingredients: [ing("Белые грибы", 300, "г"), ing("Картофель", 400, "г"), ing("Лук", 1, "шт."), ing("Морковь", 1, "шт."), ing("Вода", 2, "л")],
    search: ["Грибы", "Картофель"],
    steps: ["Отварите нарезанные грибы в воде 20 минут.", "Обжарьте лук и морковь до мягкости.", "Добавьте в суп картофель и зажарку, варите ещё 20 минут.", "Посолите, подавайте со сметаной и зеленью."],
  },
  {
    slug: "pumpkin-salad", title: "Салат с запечённой тыквой", description: "Тёплая тыква, руккола, семечки и мягкий сыр.",
    sections: ["salads"], composition: ["Клетчатка", "Полезные жиры"], time: "35 мин", servings: 2, tone: "from-accent-100 to-brand-200", main: 0,
    ingredients: [ing("Тыква", 400, "г"), ing("Руккола", 60, "г"), ing("Тыквенные семечки", 20, "г"), ing("Фета", 80, "г"), ing("Масло оливковое", 20, "мл")],
    search: ["Тыква", "Сыр"],
    steps: ["Запеките кубики тыквы с маслом 25 минут при 200 °C.", "Выложите рукколу, тёплую тыкву и раскрошенную фету.", "Посыпьте подсушенными семечками и сбрызните маслом."],
  },
  {
    slug: "chicken", title: "Курица с травами", description: "Сочные бёдра в духовке с чесноком и розмарином.",
    sections: ["hot"], composition: ["Белок"], time: "50 мин", servings: 4, tone: "from-brand-100 to-accent-300", main: 0,
    ingredients: [ing("Куриные бёдра", 800, "г"), ing("Чеснок", 4, "зубчика"), ing("Розмарин", 2, "веточки"), ing("Масло оливковое", 30, "мл"), ing("Соль", 8, "г")],
    search: ["Курица"],
    steps: ["Натрите бёдра солью, чесноком и маслом.", "Выложите в форму с розмарином.", "Запекайте 40 минут при 200 °C до золотистой корочки."],
  },
  {
    slug: "grechka", title: "Гречка с грибами и луком", description: "Рассыпчатая гречка по-купечески — гарнир или самостоятельное блюдо.",
    sections: ["sides", "hot"], composition: ["Клетчатка", "Железо"], time: "30 мин", servings: 4, tone: "from-brand-200 to-accent-200", main: 0,
    ingredients: [ing("Гречка", 200, "г"), ing("Шампиньоны", 250, "г"), ing("Лук", 1, "шт."), ing("Масло сливочное", 20, "г"), ing("Вода", 400, "мл")],
    search: ["Гречка", "Грибы"],
    steps: ["Обжарьте лук и грибы на масле до румяности.", "Добавьте промытую гречку и воду, посолите.", "Варите под крышкой 18 минут на слабом огне."],
  },
  {
    slug: "hummus", title: "Хумус из нута", description: "Нежная паста из нута с тахини и лимоном — к овощам и лепёшкам.",
    sections: ["starters", "sauces"], composition: ["Белок", "Клетчатка", "Полезные жиры"], time: "20 мин", servings: 6, tone: "from-accent-50 to-brand-200", main: 0,
    ingredients: [ing("Нут варёный", 250, "г"), ing("Тахини", 60, "г"), ing("Лимонный сок", 30, "мл"), ing("Чеснок", 1, "зубчик"), ing("Масло оливковое", 30, "мл")],
    search: ["Нут"],
    steps: ["Сложите всё в блендер, добавьте 3–4 ложки холодной воды.", "Взбейте до гладкости, посолите по вкусу.", "Подавайте с маслом и паприкой."],
  },
  {
    slug: "lemonade", title: "Домашний лимонад", description: "Освежающий, с мятой — готовится за 10 минут.",
    sections: ["drinks"], composition: [], time: "10 мин", servings: 6, tone: "from-brand-50 to-accent-200", main: 0,
    ingredients: [ing("Лимоны", 3, "шт."), ing("Сахар", 80, "г"), ing("Вода", 1.5, "л"), ing("Мята", 10, "г")],
    search: ["Лимоны"],
    steps: ["Выжмите сок из лимонов.", "Растворите сахар в стакане тёплой воды.", "Смешайте с остальной водой, соком и мятой, охладите."],
  },
  {
    slug: "sharlotka", title: "Шарлотка с яблоками", description: "Простой яблочный пирог — пышный и не приторный.",
    sections: ["baking", "desserts"], composition: [], time: "1 ч", servings: 8, tone: "from-accent-200 to-brand-300", main: 0,
    ingredients: [ing("Яблоки", 600, "г"), ing("Яйцо", 3, "шт."), ing("Сахар", 150, "г"), ing("Мука", 150, "г")],
    search: ["Яблоки", "Яйца", "Мука"],
    steps: ["Взбейте яйца с сахаром до пышности.", "Вмешайте муку, выложите в форму на нарезанные яблоки.", "Выпекайте 40 минут при 180 °C."],
  },
];

export const WEEKLY = { title: "Тёплое и домашнее на выходные", slugs: ["mushroom-soup", "grechka", "chicken", "sharlotka"] };

export const POPULAR = ["syrniki", "bliny", "hummus", "pumpkin-salad"];

export function findRecipe(slug: string): DemoRecipe | undefined {
  return RECIPES.find((recipe) => recipe.slug === slug);
}

export function pickRecipes(slugs: string[]): DemoRecipe[] {
  return slugs.map(findRecipe).filter((recipe): recipe is DemoRecipe => recipe !== undefined);
}
