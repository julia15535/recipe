import "server-only";

// Один платный запрос ИИ кабинета за раз — общий для разбора рецепта, разметки статьи и подбора тегов (ADR-0036):
// двойной клик или вторая вкладка получают «ещё идёт», а не второй оплаченный вызов. Флаг — в памяти процесса.
let busy = false;

/** true — очередь занята за нами (освободить — `releaseAiTurn` в finally); false — другой запрос ИИ ещё идёт. */
export function takeAiTurn(): boolean {
  if (busy) return false;
  busy = true;
  return true;
}

export function releaseAiTurn(): void {
  busy = false;
}
