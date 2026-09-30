import { Badge } from "@/components/base/badges/badges";

// Отметка «На скорую руку» — в персике (акцент бренда), поверх стандартного Badge через className.
export function QuickBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <Badge color="gray" size={size} className="self-start bg-accent-100 text-accent-700 ring-accent-200">
      На скорую руку
    </Badge>
  );
}
