# Сторонний код и материалы

## Untitled UI React — MIT
Исходник: https://github.com/untitleduico/react, коммит `4702dc0ea8d1` (27.09.2026).
Скопирована только бесплатная MIT-часть (PRO-компоненты, PRO-иконки и исходники Figma не используются
и не публикуются). Обновление — повторным копированием с новым коммитом, записать здесь.

Скопированные файлы:
- `styles/uui/globals.css`, `styles/uui/theme.css`, `styles/uui/typography.css`
- `utils/cx.ts`, `utils/is-react-component.ts`
- `components/base/buttons/button.tsx`
- `components/base/button-group/button-group.tsx`
- `components/base/input/input.tsx`, `label.tsx`, `hint-text.tsx`
- `components/base/tags/tags.tsx`, `base-components/tag-close-x.tsx`, `base-components/tag-checkbox.tsx`
- `components/base/badges/badges.tsx`, `badge-types.ts`
- `components/base/tooltip/tooltip.tsx`
- `components/foundations/dot-icon.tsx`
- `components/application/tabs/tabs.tsx`
- `components/application/modals/modal.tsx` (без изменений; основа нижнего листа каталога)

Изменения: в `input.tsx`, `label.tsx`, `badges.tsx`, `tags.tsx`, `tag-close-x.tsx` иконки
`@untitledui/icons` заменены на `lucide-react` (лицензия иконок Untitled UI запрещает их
распространение). Бренд проекта задаётся отдельно — `styles/brand.css`.

```
MIT License

Copyright (c) 2025 Untitled UI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Зависимости (не скопированы, ставятся из npm)
- `react-aria-components`, `tailwindcss-react-aria-components` — Apache-2.0 (Adobe)
- `lucide-react` — ISC (иконки)
- `@tailwindcss/typography`, `tailwindcss-animate`, `tailwind-merge` (его использует `utils/cx.ts`) — MIT

## Шрифты
- Prata (заголовки) и Manrope (текст) — SIL Open Font License 1.1; подключаются через `next/font/google`,
  файлы шрифтов отдаются с сайта проекта (`styles/fonts.ts`).
