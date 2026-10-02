import "server-only";
import { asc, eq } from "drizzle-orm";

import type { CatalogLabels } from "@/components/recipe/view";
import { type Executor, getDb } from "@/lib/server/db/client";
import { guarded } from "@/lib/server/db/errors";
import { compositionTagLocalizations, compositionTags, sectionLocalizations, sections } from "@/lib/server/db/schema";

export type CatalogItem = { id: string; code: string; label: string };
export type Catalog = { sections: CatalogItem[]; tags: CatalogItem[] };

/** Разделы и теги состава с русскими подписями, по порядку. Данных мало — читаем целиком. */
export function getCatalog(db: Executor = getDb()): Promise<Catalog> {
  return guarded("каталог", () => readCatalog(db));
}

async function readCatalog(db: Executor): Promise<Catalog> {
  const [sectionRows, tagRows] = await Promise.all([
    db
      .select({ id: sections.id, code: sections.code, label: sectionLocalizations.label })
      .from(sections)
      .innerJoin(sectionLocalizations, eq(sectionLocalizations.sectionId, sections.id))
      .where(eq(sectionLocalizations.locale, "ru"))
      .orderBy(asc(sections.position)),
    db
      .select({ id: compositionTags.id, code: compositionTags.code, label: compositionTagLocalizations.label })
      .from(compositionTags)
      .innerJoin(compositionTagLocalizations, eq(compositionTagLocalizations.tagId, compositionTags.id))
      .where(eq(compositionTagLocalizations.locale, "ru"))
      .orderBy(asc(compositionTags.position)),
  ]);
  return { sections: sectionRows, tags: tagRows };
}

export function catalogLabels(catalog: Catalog): CatalogLabels {
  return {
    sections: new Map(catalog.sections.map((item) => [item.code, item.label])),
    tags: new Map(catalog.tags.map((item) => [item.code, item.label])),
  };
}
