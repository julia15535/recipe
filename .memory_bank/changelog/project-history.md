---
tier: 2
topic: project-history
scope: Хронология вех/волн проекта (append-only). Снимок «где сейчас» — в project-state.md
updated: 2026-09-27
source: manual
status: working
source_of_truth: historical
---

# Project History — хронология проекта (свежее сверху)

> Append-журнал вех: волны работ, крупные merge, смены этапа. Сюда переносится хронология из
> `project-state.md`, когда снимок начинает раздуваться (audit: BLOATED). Папка `changelog/`
> исключена из decision tree и аудита — журнал не грузится в контекст без нужды, но хранит историю.

## Формат записи
```
## YYYY-MM-DD — <веха одной строкой>
<2–5 строк: что сделано/решено, ссылки на планы/ADR>
```

---

<!-- Реальные записи добавляются ниже (сверху — свежие). -->

## 2026-09-29 — Каркас и CI/CD (план stack-and-skeleton)
Утверждён стек и инфраструктура (ADR-0011…0014), две критики Codex (33 + 35 замечаний) внесены.
Каркас Next.js 16.3 + next-intl + Drizzle/Postgres, CI (один образ от e2e до прода, GHCR), серверный
pull-деплой по модели sup2 с откатом, бэкап ≤ 7 дней + локальная копия. Репо `julia15535/recipe`
(публичный: локальная история склеена в один чистый коммит, детали серверов — только в `_secrets/`).
Прод — mycoruja.food на общем сервере владельца.

## 2026-09-27 — Проект заведён: Memory Bank из ТЗ
Отдельный проект `/home/pakar/igor/recipe` (git init, ветка `main`) развёрнут из кита
memory-bank-template v1.8.0 (`apply.sh --permission-mode autopilot`, тип `dev`). Intake: ТЗ
«Личная авторская книга рецептов» (Google Drive, technical_spec_recipe_book.md) + продуктовые
решения владельца из чата → `_intake/_processed/brief/`. Собраны product_brief, 12 core-сводок,
5 доков domain/, ADR-0001…0010; стек — только предложение. Правило codex-adviser и tmux-профиль
`tmux-igor` (общая сессия `igor`) — как в соседних проектах владельца (сначала по ошибке была
заведена отдельная сессия `recipe` — убрана по замечанию владельца).
