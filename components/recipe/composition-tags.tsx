import { cx } from "@/utils/cx";

// Теги «Особенности состава» (ADR-0021): у каждого свой цвет по ассоциации — токены `--color-tag-*`
// в styles/brand.css; ключ — стабильный id тега, не подпись. Тег без своего цвета — нейтральный.
const TAG_STYLES: Record<string, string> = {
  protein: "bg-tag-protein-bg text-tag-protein-fg ring-tag-protein-border",
  fiber: "bg-tag-fiber-bg text-tag-fiber-fg ring-tag-fiber-border",
  "healthy-fats": "bg-tag-fats-bg text-tag-fats-fg ring-tag-fats-border",
  "low-sugar": "bg-tag-sugar-bg text-tag-sugar-fg ring-tag-sugar-border",
  iron: "bg-tag-iron-bg text-tag-iron-fg ring-tag-iron-border",
};
const NEUTRAL = "bg-secondary text-secondary ring-secondary";

export type CompositionTag = { id: string; label: string };

// Доступное имя группы — структура для экранного диктора, не оговорка (подписи «не КБЖУ» нет по решению владельца).
export function CompositionTags({ tags, label, className }: { tags: readonly CompositionTag[]; label: string; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label={label} className={cx("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <li
          key={tag.id}
          data-tag={tag.id}
          className={cx("rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset", TAG_STYLES[tag.id] ?? NEUTRAL)}
        >
          {tag.label}
        </li>
      ))}
    </ul>
  );
}
