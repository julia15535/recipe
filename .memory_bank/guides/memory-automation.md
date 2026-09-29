---
tier: 2
topic: memory-automation
scope: Как история проекта попадает в Memory Bank — слои, мост, хуки-напоминания, гейты
tier1: ""
updated: 2026-09-29
last_verified: 2026-09-29
importance: high
source: manual
---

# Memory Automation — как история проекта попадает в Memory Bank

> Задача: чтобы ВСЁ проектное durable оседало в `.memory_bank/` (в git, видно команде), а не
> в чате или авто-памяти харнесса. Принцип: **записывает агент (нужно суждение), а система
> напоминает, детектит дрейф и не даёт закрыть работу без захвата.**

## Два слоя и мост
- `.memory_bank/` (в git) — канон проекта, ОДНА копия, в репо кода.
- `~/.claude/projects/<cwd>/memory/` (per-user) — служебное про работу агента; харнесс пишет
  сюда по умолчанию. НЕ хранилище проекта.
- Мост: `/memory-check` Этап 1.5 реконсилит — проектное переносится в банк, per-user остаётся.
Полное правило — `.claude/rules/memory-discipline.md` (auto-loaded).

## Цикл сессии (что гарантирует полноту)
1. **Старт** — SessionStart-hook (`tools/session-freshness.mjs`) печатает баннер, если
   project-state старше 14 дней, в аудите есть problems или предупреждения (CODE-DRIFT и др.); иначе молчит. INDEX уже в контексте (@-импорт из
   CLAUDE.md — переживает и старт, и компакцию); дальше — нужные доки по decision tree.
2. **В процессе** — durable-факт фиксировать сразу (блокнот `_intake/session-scratch.md` или
   канон-файл банка, no-orphan). PostToolUse(Read)-hook (`tools/read-logger.mjs`) пассивно
   логирует чтения доков банка в `changelog/reads.log` (свежесть по контакту). PostToolUse(Edit|Write)-hook
   (`tools/code-touch-hint.mjs`, v1.9) подсказывает агенту, какие доки описывают правленый файл кода
   (`hookSpecificOutput.additionalContext`, раз на файл за сессию) — описание правится в том же изменении.
   Работает ли это — `node tools/memory-health.mjs` (журналы `changelog/code-touch-hint.log`, `verify-log.tsv`,
   `drift-report.log`, `memory-eval.log`; замер «с памятью / без» — `tools/memory-eval` (если установлен; модуль кита `_optional/memory-eval`).
3. **Перед компакцией** — PreCompact-hook (`tools/precompact-guard.mjs`): если есть незакоммиченные
   изменения вне `.memory_bank/` (`git status --porcelain`), а блокнот пуст, ОДИН раз блокирует компакцию — агент сперва выписывает durable-факты
   (иначе сжатие контекста их съедает). Одноразовость — маркер на session_id.
4. **Конец сессии** — `/memory-check`: захват → мост → сверка (этап 1.6: доки изменённого кода, CODE-DRIFT, ротация →
   `verify` → `last_verified` только по таблице доказательств, `memory-health.mjs --log-verify`) → уровни →
   связи+INDEX+реестры → чистота.
   Stop-hook (`tools/session-reminder.mjs`): в default — напоминание пользователю (только при изменениях вне банка);
   в пресетах important/autopilot/plan-first — флаг `--block`: если в `plans/` есть план `in_progress` (или
   `completed`, ещё не перенесённый) + изменения вне банка + (блокнот пуст ИЛИ в аудите есть problems — CODE-DRIFT
   Stop не считает), хук отвечает `{"decision":"block"}` — Claude
   ПОЛУЧАЕТ reason и не может завершить, пока не прогонит `/memory-check` (цикл-защита:
   `stop_hook_active` → блок максимум один раз на попытку завершения).
5. **Завершение плана** — гейт: план не `completed`, пока `/memory-check` не выполнен и audit
   не «чисто» (`agent-workflow.md`, DoD в `plans/_template.md`); крупный план — сперва
   read-only субагент `verify` (`.claude/agents/verify.md`); он же сверяет доки на этапе 1.6 `/memory-check`.

## Скиллы (инструменты)
- `/memory-init` — первичная сборка Memory Bank из `_intake/` (bootstrap; заводит core-сводки под ВСЕ домены).
- `/memory-check` — **единая команда после работы**: захват сессии → мост авто-памяти → сверка с кодом
  (этап 1.6) → уровни → связи+INDEX+реестры → структурная чистота. Запускает Клод (без рекурсии/runaway).
- `/memory-cleanup` — глубокая РАЗРУШИТЕЛЬНАЯ уборка целых доков: дубли→merge, устаревшее→архивация
  (dry-run → подтверждение). Отдельно от memory-check.

## Механический слой (Node, опционально, но рекомендован)
- `tools/memory-audit.mjs` — детерминированная проверка: полный список категорий — в его шапке
  (problems — ломают exit code: ORPHAN, STALE, LAGGING, BROKEN, CODE-REF, TIER1-BLOAT, PLAN-STUCK, SECRET и др.;
  warnings — нет: CODE-DRIFT, NO-ANCHOR, TIER0-RULES, DOC-*, KIT-* и др.) + регенерация decision tree и реестров.
  Для CI/хука: `--check` (не пишет файлы; исключение — `--drift-report` дописывает `changelog/drift-report.log`).
- Хуки в пресетах important/autopilot/plan-first: SessionStart — `session-freshness`; Stop — `session-reminder --block`
  (аудит встроен); PreCompact — `precompact-guard`; PostToolUse(Read) — `read-logger`; PostToolUse(Edit|Write) —
  `code-touch-hint`. `tools/stop-hook.example.json` (default) — те же без `--block` и без `read-logger`. Без Node
  запасной shell-вариант есть только у Stop, остальные хуки молча пропускаются.

## Почему не авто-хук ЗАПИСИ на каждый SessionEnd
Авто-запись контента опасна (рекурсия, стоимость, нужно суждение о том, что durable). Поэтому
запись — через скилл, который запускает Клод; система лишь НАПОМИНАЕТ (хуки), ДЕТЕКТИТ дрейф
(audit) и ГЕЙТИТ завершение (Stop `--block` + PreCompact-guard — гейт БЛОКИРУЮЩИЙ, но пишет
всё равно агент). Это осознанный дизайн, не пробел.

## Старт разработки «с нуля» в этом проекте
Memory Bank самодостаточен: новая сессия читает `CLAUDE.md` → `INDEX.md` → `project-state.md` и
может продолжать. Скиллы `/memory-*` установлены в `.claude/skills/`. Версия кита — `.memory_bank/_kit/VERSION`
(обновление kit-owned файлов — `upgrade.sh` из кита).
