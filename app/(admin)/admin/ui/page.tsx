import type { Metadata } from "next";

import { DesignPreview } from "./_components/design-preview";

export const metadata: Metadata = { title: "Проба дизайна · Книга рецептов" };

export default function DesignPreviewPage() {
  return <DesignPreview />;
}
