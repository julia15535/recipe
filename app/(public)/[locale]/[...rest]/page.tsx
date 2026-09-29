import { notFound } from "next/navigation";

// Любой неизвестный путь внутри локали — локализованная 404 (app/(public)/[locale]/not-found.tsx).
export default function CatchAllPage(): never {
  notFound();
}
