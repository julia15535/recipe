import NextLink from "next/link";

import type { ArticleListItem } from "@/lib/server/articles/queries";

import { StatusBadge } from "../../recipes/_components/status-badge";

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// «Мои статьи»: название (ссылка на статью), когда меняли, статус; пусто — подсказка.
export function ArticleList({ articles }: { articles: ArticleListItem[] }) {
  if (articles.length === 0) {
    return <p className="text-md text-tertiary">Статей пока нет. Нажмите «Новая статья» и вставьте текст — фото добавите потом.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-secondary">
      {articles.map((article) => (
        <li key={article.id}>
          <NextLink href={`/admin/articles/${article.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 underline-offset-4 hover:underline">
            <span className="text-md font-semibold break-words text-primary">{article.title}</span>
            <span className="flex items-center gap-3 text-sm text-tertiary">
              {DATE.format(article.updatedAt)}
              <StatusBadge status={article.status} />
            </span>
          </NextLink>
        </li>
      ))}
    </ul>
  );
}
