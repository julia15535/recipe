"use client";

import type { KeyboardEvent, RefObject } from "react";

import { type Style, toggleStyle } from "@/lib/domain/article-text/format-edit";

// Кнопки «Ж» / «К» над полем текста статьи (план article-formatting, ADR-0037): выделила слова → нажала — сайт сам
// ставит звёздочки (на сайте их не видно), повтор снимает. На компьютере — ещё Ctrl/⌘+B и Ctrl/⌘+I. Правка — через
// вставку текста браузером, где он умеет (тогда работает «Отменить»), иначе — новым значением поля.
type Props = { field: RefObject<HTMLTextAreaElement | null>; controls: string; onText: (value: string) => void };

export function applyStyle(field: HTMLTextAreaElement, style: Style, onText: (value: string) => void) {
  const before = field.value;
  const next = toggleStyle({ text: before, start: field.selectionStart, end: field.selectionEnd }, style);
  // Меняем только отличающийся кусок — меньше вставка, точнее «Отменить».
  let head = 0;
  while (head < before.length && head < next.text.length && before[head] === next.text[head]) head += 1;
  let tail = 0;
  while (tail < before.length - head && tail < next.text.length - head && before.at(-1 - tail) === next.text.at(-1 - tail)) tail += 1;
  field.focus();
  field.setSelectionRange(head, before.length - tail);
  const inserted = document.execCommand("insertText", false, next.text.slice(head, next.text.length - tail));
  if (inserted && field.value === next.text) {
    // Браузер сам вставил (и сообщил полю) — выделение ставим сразу: отложенное перебило бы следующее выделение.
    field.setSelectionRange(next.start, next.end);
    return;
  }
  onText(next.text);
  requestAnimationFrame(() => field.setSelectionRange(next.start, next.end));
}

/** Ctrl/⌘+B и Ctrl/⌘+I в поле — по клавише, не по букве (работает и в русской раскладке). */
export function styleShortcut(event: KeyboardEvent<HTMLTextAreaElement>, onText: (value: string) => void) {
  // На Mac — ⌘ (Ctrl+B там «курсор назад»), с Shift — чужие сочетания (Ctrl+Shift+I — инструменты браузера); набор иероглифов
  // и т. п. (isComposing) не трогаем.
  const mac = /Mac|iPhone|iPad/u.test(navigator.platform || navigator.userAgent);
  if (!(mac ? event.metaKey : event.ctrlKey) || event.shiftKey || event.altKey || event.nativeEvent.isComposing) return;
  const style = event.code === "KeyB" ? "bold" : event.code === "KeyI" ? "italic" : null;
  if (!style) return;
  event.preventDefault();
  applyStyle(event.currentTarget, style, onText);
}

const BUTTON =
  "flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-primary px-3 text-lg text-primary ring-1 ring-primary ring-inset hover:bg-accent-50 focus-visible:ring-2 focus-visible:ring-brand outline-hidden";

export function FormatToolbar({ field, controls, onText }: Props) {
  const press = (style: Style) => {
    if (field.current) applyStyle(field.current, style, onText);
  };
  return (
    <div role="group" aria-label="Оформление текста" aria-controls={controls} className="flex gap-2">
      {/* pointerdown не уводит фокус из поля — выделение слов не теряется */}
      <button type="button" aria-label="Жирный" title="Жирный (Ctrl+B, на Mac ⌘B)" className={`${BUTTON} font-bold`} onPointerDown={(event) => event.preventDefault()} onClick={() => press("bold")}>
        Ж
      </button>
      <button type="button" aria-label="Курсив" title="Курсив (Ctrl+I, на Mac ⌘I)" className={`${BUTTON} italic`} onPointerDown={(event) => event.preventDefault()} onClick={() => press("italic")}>
        К
      </button>
    </div>
  );
}
