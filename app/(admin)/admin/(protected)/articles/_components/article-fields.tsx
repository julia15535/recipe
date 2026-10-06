// Поля статьи: название (пишет владелец) и текст — большое поле, без автозамены: текст сохраняется как вставлен.
const FIELD = "w-full rounded-xl bg-primary p-3 text-md text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand";

type Props = { title: string; text: string; onTitle: (value: string) => void; onText: (value: string) => void };

export function ArticleFields({ title, text, onTitle, onText }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="article-title" className="text-md font-semibold text-primary">
          Название
        </label>
        <input id="article-title" value={title} onChange={(event) => onTitle(event.target.value)} maxLength={120} className={`min-h-11 ${FIELD}`} placeholder="Например: Вафли — варианты подачи" />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="article-text" className="text-md font-semibold text-primary">
          Текст статьи
        </label>
        <p id="article-text-hint" className="text-sm text-tertiary">
          Вставьте как есть. ИИ только отметит заголовки, абзацы и списки — слова останутся вашими. Фото добавите после
          сохранения, между абзацами; строки вида «[Фото Q7K2]» — места фото, их можно переносить.
        </p>
        <textarea
          id="article-text"
          aria-describedby="article-text-hint"
          value={text}
          onChange={(event) => onText(event.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={`min-h-[50dvh] ${FIELD}`}
          placeholder={"Например: Вафли можно подать по-разному.\n\nС творожным сыром и рыбой\nНамажьте вафлю сыром…"}
        />
      </div>
    </div>
  );
}
