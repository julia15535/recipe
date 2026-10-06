import type { ArticleIssue } from "@/lib/domain/article-text/types";
import { cx } from "@/utils/cx";

const GROUPS: { group: ArticleIssue["group"]; title: string; tone: string }[] = [
  { group: "decide", title: "Нужно решить", tone: "text-error-primary" },
  { group: "note", title: "Замечания", tone: "text-tertiary" },
];

// «Проверьте» после разбора статьи: что решить (без этого сохранить нельзя) и замечания. Слова ИИ не меняет —
// поэтому группы «что сделал ИИ», как у рецепта, нет.
export function ArticleChecks({ issues, ready }: { issues: ArticleIssue[]; ready: boolean }) {
  return (
    <section aria-labelledby="article-checks-title" className="flex flex-col gap-4 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
      <h2 id="article-checks-title" className="font-display text-xl text-primary">
        Проверьте
      </h2>
      <p className="text-md text-secondary">
        {ready
          ? "Текст разложен на заголовки, абзацы и списки — слова ваши, без изменений. Посмотрите, как статья будет выглядеть."
          : "Есть то, что нужно решить: поправьте текст и нажмите «Разобрать» ещё раз."}
      </p>
      {GROUPS.map(({ group, title, tone }) => {
        const items = issues.filter((issue) => issue.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} data-checks={group} className="flex flex-col gap-2">
            <h3 className="text-md font-semibold text-primary">{title}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {items.map((issue, index) => (
                <li key={`${group}-${index}`} className={cx("text-md break-words", tone)}>
                  {issue.text}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
