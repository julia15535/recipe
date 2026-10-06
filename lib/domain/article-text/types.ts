// Статья (план articles): владелец пишет текст сама, ИИ только размечает строки — заголовок, абзац, пункт списка
// (критика Codex 04.10: ИИ не перепечатывает текст). Слова блока код берёт из строк её текста, поэтому изменить их
// нельзя; фото стоят там, где в тексте строка-метка «[Фото Q7K2]».

/** Разметка строк: вид и диапазон строк текста (с 0, включительно). Пункт списка — одна запись на пункт. */
export type MarkKind = "h2" | "h3" | "p" | "bullet" | "number";
export type Mark = { kind: MarkKind; from: number; to: number };

/** У блоков — диапазон строк текста: по нему «Добавить фото сюда» ставит метку после блока. */
export type ArticleBlock =
  | { id: string; type: "heading"; level: 2 | 3; text: string; from: number; to: number }
  | { id: string; type: "paragraph"; text: string; from: number; to: number }
  | { id: string; type: "list"; ordered: boolean; items: { text: string; from: number; to: number }[] }
  | { id: string; type: "photo"; key: string; line: number };

export const ARTICLE_SCHEMA_VERSION = 1;
export type ArticleBody = { schemaVersion: typeof ARTICLE_SCHEMA_VERSION; blocks: ArticleBlock[] };

/** Пункт «Проверьте»: нужно решить (сохранить нельзя) или замечание. */
export type ArticleIssue = { group: "decide" | "note"; text: string };
