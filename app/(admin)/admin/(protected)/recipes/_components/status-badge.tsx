import { cx } from "@/utils/cx";

export function StatusBadge({ status }: { status: "draft" | "published" }) {
  return (
    <span
      data-status={status}
      className={cx(
        "inline-flex shrink-0 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
        status === "published" ? "bg-accent-100 text-primary ring-accent-300" : "bg-secondary text-secondary ring-secondary",
      )}
    >
      {status === "published" ? "Опубликован" : "Черновик"}
    </span>
  );
}
