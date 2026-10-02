import type { Issue } from "@/lib/domain/recipe-text/issues";
import { cx } from "@/utils/cx";

// «Что поправить»: номер строки, сама строка и простое объяснение. Ошибки — сначала и красным,
// предупреждения — спокойным цветом (сохранить с ними можно).
export function ParseIssues({ issues }: { issues: Issue[] }) {
  const errors = issues.filter((item) => item.severity === "error").length;
  if (issues.length === 0) {
    return (
      <p role="status" className="rounded-xl bg-accent-50 p-4 text-md text-primary">
        Всё понятно. Проверьте, как рецепт будет выглядеть на сайте.
      </p>
    );
  }
  return (
    <section aria-labelledby="issues-title" className="flex flex-col gap-3 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
      <h2 id="issues-title" className="font-display text-xl text-primary">
        Что поправить
      </h2>
      {errors > 0 && <p className="text-md text-secondary">Пока есть ошибки, сохранить нельзя — исправьте текст и проверьте ещё раз.</p>}
      <ul className="flex flex-col gap-3">
        {issues.map((item, index) => (
          <li key={`${item.code}-${item.line ?? "x"}-${index}`} data-issue={item.code} className="flex flex-col gap-1">
            <p className={cx("text-md", item.severity === "error" ? "text-error-primary" : "text-secondary")}>
              {item.line !== null && <span className="font-semibold">Строка {item.line}: </span>}
              {item.message}
            </p>
            {item.raw && <p className="rounded-lg bg-secondary px-2 py-1 font-mono text-sm break-words text-tertiary">{item.raw}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
