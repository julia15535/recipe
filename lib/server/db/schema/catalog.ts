// Каталог (ADR-0017/0018/0019): разделы и теги состава — данные в БД со стабильными id и code; подписи и
// slug — по локалям. Словари распознавания текста и цвета тегов — в коде (lib/domain/catalog.ts).
import { sql } from "drizzle-orm";
import { check, foreignKey, integer, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";

export const LOCALES = ["ru", "en"] as const;
const localeCheck = (name: string, column: unknown) => check(name, sql`${column} in ('ru', 'en')`);
const codeCheck = (name: string, column: unknown) => check(name, sql`${column} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`);

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey(),
    code: text("code").notNull().unique(),
    parentId: uuid("parent_id"),
    position: integer("position").notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id], name: "sections_parent_fk" }),
    codeCheck("sections_code_check", t.code),
    check("sections_position_check", sql`${t.position} >= 0`),
  ],
);

export const sectionLocalizations = pgTable(
  "section_localizations",
  {
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: LOCALES }).notNull(),
    label: text("label").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sectionId, t.locale] }),
    unique("section_localizations_locale_slug_unique").on(t.locale, t.slug),
    localeCheck("section_localizations_locale_check", t.locale),
    codeCheck("section_localizations_slug_check", t.slug),
  ],
);

export const compositionTags = pgTable(
  "composition_tags",
  {
    id: uuid("id").primaryKey(),
    code: text("code").notNull().unique(),
    position: integer("position").notNull(),
  },
  (t) => [codeCheck("composition_tags_code_check", t.code), check("composition_tags_position_check", sql`${t.position} >= 0`)],
);

export const compositionTagLocalizations = pgTable(
  "composition_tag_localizations",
  {
    tagId: uuid("tag_id")
      .notNull()
      .references(() => compositionTags.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: LOCALES }).notNull(),
    label: text("label").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.locale] }), localeCheck("composition_tag_localizations_locale_check", t.locale)],
);
