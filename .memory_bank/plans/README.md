# Plans — активные планы

## Lifecycle
```
draft → in_progress → completed → перенос в completed_plans/
                   ↘ partial   → остаётся здесь ТОЛЬКО с pause_reason / resume_trigger / review_after
        cancelled / отложенное / поглощённое → archive/plans/ (archived, archive_reason, superseded_by)
```
Только `completed` переносятся в `completed_plans/`. **Гейт:** план не становится `completed`, пока
не выполнен `/memory-check` и audit не «чисто» (см. `.claude/rules/agent-workflow.md`).

## Статусы и поля
| Статус | Описание |
|--------|----------|
| `draft` | Создан, ждёт команду «деплой». Без движения > 30 дней и без будущего `review_after` → `PLAN-DRAFT-STALE` (warning): деплой, дата пересмотра или архив |
| `in_progress` | Деплой начат. Без движения > 14 дней → `PLAN-STUCK` |
| `partial` | Прерван. Обязательны `pause_reason` (почему), `resume_trigger` (когда вернуться), `review_after`; иначе `PLAN-PARTIAL-NO-REASON` (warning) |

> **Мастер-планы (v1.9):** портфель или трек, который живёт долго по природе, помечай `plan_kind: portfolio_master` или
> `track_master` и ставь будущую `review_after` — тогда аудит не считает его застрявшим (`PLAN-STUCK`); дата пересмотра
> прошла или не задана — снова `PLAN-STUCK` с подсказкой.
| `completed` | Всё выполнено → перенести в `completed_plans/` |
| `cancelled` | Отменён явно → после записи уроков в `archive/plans/` |

Статус вне словаря (`active`, `living`, `in-progress` с дефисом) реестр и `PLAN-STUCK` не видят —
аудит предупреждает `PLAN-STATUS`. Доп. поля (плоские строки): `plan_kind` — `portfolio_master`
(один на проект) · `track_master` (+ `parent_plan`) · `sub`; `owner_decision_required`.
Поглощённое/заменённое уходит в `archive/plans/` со статусом как есть + `archived: дата`,
`archive_reason`, `superseded_by` — обратимо (`git mv` назад). Отложенное с известной датой возврата
остаётся здесь (`draft`/`partial` + `review_after`): архив вне lifecycle-аудита, дату там никто не увидит. Кладбище планов чинит триаж
таблицей на утверждение владельцу (`HEAL.md`), а не автоотмена.

## Реестр активных планов

<!-- GENERATED:plans-registry START -->
<!-- Таблицу регенерирует tools/memory-audit.mjs из frontmatter. Не редактируй вручную. -->

| slug | Название | status | created | updated |
|------|----------|--------|---------|---------|
| design-system-uui | Дизайн-система — Untitled UI React из исходного репозитория + своя «оливковая» палитра для еды | in_progress | 2026-09-29 | 2026-09-29 |
<!-- GENERATED:plans-registry END -->

> Шаблон нового плана — `_template.md`. Реестр регенерирует аудит — руками не правим.
> Audit ловит зомби: `in_progress` без движения (PLAN-STUCK), `completed` в этой папке
> (PLAN-MISPLACED) — это блокеры; предупреждения о гниении — PLAN-DRAFT-STALE, PLAN-PARTIAL-NO-REASON,
> PLAN-STATUS.
