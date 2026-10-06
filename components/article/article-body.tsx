import { Fragment, type ReactNode } from "react";

import { RecipeGrid } from "@/components/recipe/recipe-card";
import { RecipePhoto } from "@/components/recipe/recipe-photo";
import type { ArticleBlock } from "@/lib/domain/article-text/types";

import type { ArticleView } from "./view";

// Статья (ADR-0034) — одна вёрстка для сайта и предпросмотра в кабинете: только текст как React-узлы (никакого
// HTML из текста), фото 4:3 между абзацами с подписью, внизу — карточки связанных рецептов. Кабинет добавляет свои
// кнопки: `after` — под блоком (по id блока; «top» — перед первым), `tools` — у фото (по коду метки).
type Props = {
  view: ArticleView;
  recipesLabel: string;
  after?: Record<string, ReactNode>;
  tools?: Record<string, ReactNode>;
  missingPhoto?: (key: string) => ReactNode;
};

const PHOTO_SIZES = "(min-width: 768px) 720px, 100vw";

function Block({ block, view, tools, missingPhoto }: { block: ArticleBlock } & Pick<Props, "view" | "tools" | "missingPhoto">) {
  if (block.type === "heading") {
    return block.level === 2 ? (
      <h2 className="mt-4 font-display text-display-xs text-primary">{block.text}</h2>
    ) : (
      <h3 className="mt-2 font-display text-xl text-primary">{block.text}</h3>
    );
  }
  if (block.type === "paragraph") return <p className="text-lg leading-relaxed text-primary">{block.text}</p>;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List className={`flex flex-col gap-1.5 pl-6 text-lg leading-relaxed text-primary ${block.ordered ? "list-decimal" : "list-disc"}`}>
        {block.items.map((item) => (
          <li key={item.from}>{item.text}</li>
        ))}
      </List>
    );
  }
  const photo = view.photos[block.key];
  if (!photo) return missingPhoto?.(block.key) ?? null;
  return (
    <figure className="flex flex-col gap-2" data-photo={block.key}>
      <RecipePhoto photo={photo.ref} alt={photo.alt} sizes={PHOTO_SIZES} className="rounded-2xl" />
      {photo.caption && <figcaption className="text-md text-tertiary">{photo.caption}</figcaption>}
      {tools?.[block.key]}
    </figure>
  );
}

export function ArticleBody({ view, recipesLabel, after, tools, missingPhoto }: Props) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4">
      <h1 className="font-display text-display-sm text-primary lg:text-display-md">{view.title}</h1>
      {after?.top}
      {view.blocks.map((block) => (
        <Fragment key={block.id}>
          <Block block={block} view={view} tools={tools} missingPhoto={missingPhoto} />
          {after?.[block.id]}
        </Fragment>
      ))}
      {view.recipes.length > 0 && (
        <section aria-labelledby="article-recipes" className="mt-6 flex flex-col gap-4">
          <h2 id="article-recipes" className="font-display text-display-xs text-primary">
            {recipesLabel}
          </h2>
          <RecipeGrid cards={view.recipes} />
        </section>
      )}
    </article>
  );
}
