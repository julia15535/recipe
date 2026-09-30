---
description: UI-правила — mobile-first книги рецептов (ТЗ §21), дизайн-система Untitled UI, токены, состояния экранов
paths:
  - "app/**/*.tsx"
  - "app/**/*.jsx"
  - "components/**/*.tsx"
  - "components/**/*.jsx"
  - "styles/**/*.css"
  - "**/globals.css"
---

# UI-правила

> Дизайн-система — **Untitled UI React** (Tailwind 4 + React Aria), копия upstream, ADR-0015.
> Бренд (цвета, шрифты) — только `styles/brand.css`; пробная страница — `/admin/ui`.
> Экраны и сценарии — `.memory_bank/core/ux.md`.

## Mobile-first — принципиально (ТЗ §21)
- Базовые стили — мобильные (проверка на 375 px), расширяем брейкпоинтами вверх.
- Всё ключевое — одной рукой: цели касания ≥ 44 px (e2e `e2e/design.spec.ts` проверяет). Кнопки —
  `AppButton` (`components/app-button.tsx`: размер `xl` = 44 px, форма «таблетка»); у остальных
  компонентов upstream размеры меньше — добавляй `min-h-11` снаружи.
- **Без мелких элементов и сложных desktop-dropdown**: выбор — чипы (выбор касанием по всей чипе, не
  по мелкому крестику), сегменты, нижние листы.
- Подсказки на тач — Popover по тапу, не Tooltip (Tooltip React Aria на тач-экранах не открывается).
- Минимум лишнего: большая структура каталога — в каталоге и SEO-футере, не в основном интерфейсе.
- Страница рецепта удобна у плиты: компактная шапка, табы «Рецепт / Приготовление».

## Дизайн-токены
- Только **семантические** токены UUI: `bg-primary` (карточки), `bg-page` (фон страницы),
  `bg-secondary`, `text-primary|secondary|tertiary`, `text-brand-secondary`, `border-secondary`,
  `bg-brand-solid`; акцент-персик — `bg-accent-50…400`, `text-accent-700`.
- Запрещены сырые цвета (`bg-white`, `text-gray-*`, hex в классах) — ломают бренд и будущую тёмную тему.
- Заголовки — `font-display` (Lora, с засечками), текст — Inter по умолчанию. Шрифт — только с кириллицей
  (проверять subsets в next/font: у Fraunces, Young Serif, Newsreader её нет).

## Компоненты
- Компоненты upstream (`components/base|application|foundations`) не правим: стиль меняем через
  `className` и `brand.css`. Нужен новый — копируем из upstream того же коммита и пишем в
  `THIRD_PARTY_NOTICES.md`. PRO-компоненты и иконки `@untitledui/icons` — нельзя (лицензии).
- Иконки — только `lucide-react`.
- Ссылки-кнопки (`href`) — через провайдеры `components/providers/*-router-provider.tsx`
  (публичный добавляет префикс локали сам; путь с `/ru`/`/en` оставляет как есть).
- Группа «один из вариантов» (ButtonGroup) в React Aria — роль `radio`, не `button` (важно для тестов).

## Состояния
Каждый экран покрывает `loading` / `error+retry` / `empty` / `success`.
Поиск отвечает мгновенно: без блокирующих спиннеров на каждый символ.

> Доменные ограничения (тон, дисклеймеры и т.п.) — выноси в отдельный path-scoped rule,
> см. `.memory_bank/guides/how-to-write-rules.md`.
