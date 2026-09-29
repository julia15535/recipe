# _optional — каталог подключаемых модулей

> Эти модули **не копируются** в проект по умолчанию. `/memory-init` (или ты вручную) копирует
> нужные по релевантности — чтобы свежий memory bank не раздувался лишним. После копирования
> проставь frontmatter и зарегистрируй в `INDEX.md` (decision tree это сделает аудит).

## Куда копировать
- `memory/*` → `.memory_bank/` (Tier 1/2 доки).
- `rules/*` → `.claude/rules/` (path-scoped или always-on правила).
- `quality-standards/*` → `.memory_bank/reference/quality-standards/` (переносимые эталоны качества).

## Каталог

| Модуль | Когда брать | Куда |
|--------|-------------|------|
| `memory/patterns.md` | есть типовые повторяющиеся фичи/экраны | `.memory_bank/` |
| `memory/glossary.md` | важна консистентность терминов/токенов/тона | `.memory_bank/` |
| `memory/sync-with-external.md` | проект зависит от внешнего источника правды (backend, др. репо) | `.memory_bank/` |
| `memory/deployment.md` | есть прод/CI-CD | `.memory_bank/` |
| `memory/quality-criteria.md` | готовишься к проду/пилоту, хочешь поднять зрелость качества по эталонам | `.memory_bank/` |
| `quality-standards/*` | нужен полный свод senior-критериев (backend/sql/frontend/android) как канон | `.memory_bank/reference/quality-standards/` |
| `rules/guardrails.md` | есть боевой трафик / нельзя ломать живой флоу | `.claude/rules/` |
| `rules/agent-orchestration.md` | планируешь запускать несколько агентов параллельно | `.claude/rules/` |

> Не уверен — не копируй. Модуль легко добавить позже; лишний модуль зашумляет навигацию.

> `anti-patterns.md` с v1.4.0 НЕ здесь — он в `template/.memory_bank/` (рекомендован по умолчанию,
> вместе с `core/lessons.md`): по данным исследований procedural memory (паттерны/анти-паттерны +
> уроки провалов) даёт SE-агентам основной прирост. Для notes-проекта его можно удалить.

## Паттерн «уроки по темам» (не модуль — приём для выросших банков)
Когда `anti-patterns.md` + `core/lessons.md` переваливают за ~50 KB (по флоту 2026-09 это был один
проект из десяти — remlab, 220 KB), правило «читать уроки перед планом» перестаёт выполняться.
Приём: `lessons/<тема>.md` (8–10 тем, записи дословно, `tier: 2`, `topic: lessons-<тема>`,
`tier1: ../core/lessons.md`), `lessons/README.md` — карта «номер → файл», пропуски и дубли номеров
признаны явно, «следующий номер»; `core/lessons.md` (≤3 KB) — маршрутизатор: тема → 2–4 живых
правила + путь. Перенос — только дословно (CLEANUP_POLICY запрещает сжимать уроки), с проверкой
«число записей и хеш текстов до == после». Образец: `remlab/.memory_bank/lessons/`,
скрипты — `remlab/tools/memory-migrations/2026-09/`.
