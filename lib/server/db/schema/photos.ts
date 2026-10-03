// Фото блюда (план recipe-photos, ADR-0028): одно на рецепт, в Postgres. `recipe_photos` — кадр 4:3 в пикселях
// уменьшенного исходника; `recipe_photo_files` — готовые файлы: исходник (только владельцу, для «Изменить кадр»),
// WebP по ширине и превью ссылки. Байты — `STORAGE EXTERNAL` (уже сжатое не пережимать) — ручная часть миграции 0007.
import { sql } from "drizzle-orm";
import { check, customType, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";

export const PHOTO_FILES = ["source", "w480", "w960", "w1600", "og"] as const;
export type PhotoFileName = (typeof PHOTO_FILES)[number];

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const recipePhotos = pgTable(
  "recipe_photos",
  {
    id: uuid("id").primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .unique("recipe_photos_recipe_unique")
      .references(() => recipes.id, { onDelete: "cascade" }),
    sourceWidth: integer("source_width").notNull(),
    sourceHeight: integer("source_height").notNull(),
    cropLeft: integer("crop_left").notNull(),
    cropTop: integer("crop_top").notNull(),
    cropWidth: integer("crop_width").notNull(),
    cropHeight: integer("crop_height").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("recipe_photos_source_check", sql`${t.sourceWidth} between 1 and 4096 and ${t.sourceHeight} between 1 and 4096`),
    check(
      "recipe_photos_crop_check",
      sql`${t.cropLeft} >= 0 and ${t.cropTop} >= 0 and ${t.cropWidth} >= 1 and ${t.cropHeight} >= 1
        and ${t.cropLeft} + ${t.cropWidth} <= ${t.sourceWidth} and ${t.cropTop} + ${t.cropHeight} <= ${t.sourceHeight}
        and abs(${t.cropWidth} * 3 - ${t.cropHeight} * 4) <= 4`,
    ),
  ],
);

export const recipePhotoFiles = pgTable(
  "recipe_photo_files",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => recipePhotos.id, { onDelete: "cascade" }),
    name: text("name", { enum: PHOTO_FILES }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    contentType: text("content_type").notNull(),
    bytes: bytea("bytes").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.photoId, t.name] }),
    check("recipe_photo_files_name_check", sql`${t.name} in ('source', 'w480', 'w960', 'w1600', 'og')`),
    check("recipe_photo_files_type_check", sql`${t.contentType} in ('image/jpeg', 'image/webp')`),
    check("recipe_photo_files_size_check", sql`${t.width} between 1 and 4096 and ${t.height} between 1 and 4096`),
    check("recipe_photo_files_bytes_check", sql`octet_length(${t.bytes}) between 1 and 1048576`),
  ],
);
