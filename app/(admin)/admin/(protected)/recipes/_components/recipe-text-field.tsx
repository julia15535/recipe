// Поле текста рецепта: большое (полэкрана телефона), без автозамены — текст сохраняется как вставлен.
export function RecipeTextField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="recipe-text" className="text-md font-semibold text-primary">
        Рецепт
      </label>
      <p id="recipe-text-hint" className="text-sm text-tertiary">
        Вставьте как есть: абзацем, списком, из заметок или PDF. ИИ разложит по ингредиентам и шагам, а вы проверите.
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
        placeholder={"Например: Сырники. Творог 500 г, яйцо, 2 ложки сахара, мука. Творог размять, добавить яйцо…"}
      />
    </div>
  );
}
