import type { Check } from "@/lib/domain/recipe-text/ai-recipe";
import { cx } from "@/utils/cx";

const GROUPS: { group: Check["group"]; title: string; tone: string }[] = [
  { group: "decide", title: "Нужно решить", tone: "text-error-primary" },
  { group: "changed", title: "Что сделал ИИ", tone: "text-secondary" },
  { group: "note", title: "Замечания", tone: "text-tertiary" },
];

// «Проверьте» после ИИ-разбора: что решить (без этого сохранить нельзя), что ИИ изменил (с цитатой из
// текста), замечания. Пустые группы не показываются.
export function AiChecks({ checks, ready }: { checks: Check[]; ready: boolean }) {
  return (
    <section aria-labelledby="ai-checks-title" className="flex flex-col gap-4 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
      <h2 id="ai-checks-title" className="font-display text-xl text-primary">
        Проверьте
      </h2>
      <p className="text-md text-secondary">
        {ready
          ? "ИИ разложил рецепт. Посмотрите, что он сделал, и как рецепт будет выглядеть на сайте."
          : "Есть то, что нужно решить: допишите это в тексте и нажмите «Разобрать» ещё раз."}
      </p>
      {GROUPS.map(({ group, title, tone }) => {
        const items = checks.filter((check) => check.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} data-checks={group} className="flex flex-col gap-2">
            <h3 className="text-md font-semibold text-primary">{title}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {items.map((check, index) => (
                <li key={`${group}-${index}`} className={cx("text-md break-words", tone)}>
                  {check.text}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
