// Поле текста рецепта: большое (полэкрана телефона), без автозамены — текст сохраняется как вставлен.
export function RecipeTextField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="recipe-text" className="text-md font-semibold text-primary">
        Текст рецепта
      </label>
      <p id="recipe-text-hint" className="text-sm text-tertiary">
        Как пишете обычно: название, «Теги: завтрак, белок», «Ингредиенты:» (у основного — «— основной ингредиент»),
        «Приготовление:» с шагами по номерам.
      </p>
      <textarea
        id="recipe-text"
        aria-describedby="recipe-text-hint"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="min-h-[50dvh] w-full rounded-xl bg-primary p-3 text-md text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
        placeholder={"Творожные вафли\nТеги: завтрак, белок\nИнгредиенты:\n● Творог — 275 г - основной ингредиент\n…\nПриготовление:\n1. …"}
      />
    </div>
  );
}
