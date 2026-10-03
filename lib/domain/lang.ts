// Языки сайта (ADR-0009, ADR-0029): русский — основной, английский — перевод. Доменные функции получают язык
// параметром и возвращают числа и коды, а не фразы: слова подставляет интерфейс (messages/{ru,en}.json).
export type Lang = "ru" | "en";
export const NUMBER_LOCALE: Record<Lang, string> = { ru: "ru-RU", en: "en-GB" };

/** Для числовых форматов: один экземпляр на язык и вид (Intl дорогой в создании). */
export function perLang<T>(make: (locale: string) => T): (lang: Lang) => T {
  const cache = new Map<Lang, T>();
  return (lang) => {
    let value = cache.get(lang);
    if (!value) cache.set(lang, (value = make(NUMBER_LOCALE[lang])));
    return value;
  };
}
