CREATE TABLE "article_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_text" text NOT NULL,
	"marks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_imports_source_text_check" CHECK (octet_length("article_imports"."source_text") between 1 and 20480)
);
--> statement-breakpoint
CREATE TABLE "article_localizations" (
	"article_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	CONSTRAINT "article_localizations_article_id_locale_pk" PRIMARY KEY("article_id","locale"),
	CONSTRAINT "article_localizations_locale_slug_unique" UNIQUE("locale","slug"),
	CONSTRAINT "article_localizations_locale_check" CHECK ("article_localizations"."locale" in ('ru', 'en')),
	CONSTRAINT "article_localizations_slug_check" CHECK ("article_localizations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("article_localizations"."slug") <= 80),
	CONSTRAINT "article_localizations_title_check" CHECK (length("article_localizations"."title") between 1 and 120),
	CONSTRAINT "article_localizations_excerpt_check" CHECK ("article_localizations"."excerpt" is null or length("article_localizations"."excerpt") between 1 and 300)
);
--> statement-breakpoint
CREATE TABLE "article_photo_files" (
	"photo_id" uuid NOT NULL,
	"name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	CONSTRAINT "article_photo_files_photo_id_name_pk" PRIMARY KEY("photo_id","name"),
	CONSTRAINT "article_photo_files_name_check" CHECK ("article_photo_files"."name" in ('source', 'w480', 'w960', 'w1600', 'og')),
	CONSTRAINT "article_photo_files_type_check" CHECK ("article_photo_files"."content_type" in ('image/jpeg', 'image/webp')),
	CONSTRAINT "article_photo_files_size_check" CHECK ("article_photo_files"."width" between 1 and 4096 and "article_photo_files"."height" between 1 and 4096),
	CONSTRAINT "article_photo_files_bytes_check" CHECK (octet_length("article_photo_files"."bytes") between 1 and 1048576)
);
--> statement-breakpoint
CREATE TABLE "article_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"key" text NOT NULL,
	"caption" text,
	"source_width" integer NOT NULL,
	"source_height" integer NOT NULL,
	"crop_left" integer NOT NULL,
	"crop_top" integer NOT NULL,
	"crop_width" integer NOT NULL,
	"crop_height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_photos_article_key_unique" UNIQUE("article_id","key"),
	CONSTRAINT "article_photos_key_check" CHECK ("article_photos"."key" ~ '^[A-HJ-NP-Z2-9]{4}$'),
	CONSTRAINT "article_photos_caption_check" CHECK ("article_photos"."caption" is null or length("article_photos"."caption") between 1 and 300),
	CONSTRAINT "article_photos_source_check" CHECK ("article_photos"."source_width" between 1 and 4096 and "article_photos"."source_height" between 1 and 4096),
	CONSTRAINT "article_photos_crop_check" CHECK ("article_photos"."crop_left" >= 0 and "article_photos"."crop_top" >= 0 and "article_photos"."crop_width" >= 1 and "article_photos"."crop_height" >= 1
        and "article_photos"."crop_left" + "article_photos"."crop_width" <= "article_photos"."source_width" and "article_photos"."crop_top" + "article_photos"."crop_height" <= "article_photos"."source_height"
        and abs("article_photos"."crop_width" * 3 - "article_photos"."crop_height" * 4) <= 4)
);
--> statement-breakpoint
CREATE TABLE "article_recipes" (
	"article_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "article_recipes_article_id_recipe_id_pk" PRIMARY KEY("article_id","recipe_id"),
	CONSTRAINT "article_recipes_position_unique" UNIQUE("article_id","position"),
	CONSTRAINT "article_recipes_position_check" CHECK ("article_recipes"."position" between 0 and 19)
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_text" text NOT NULL,
	"body" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"content_revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "articles_status_check" CHECK ("articles"."status" in ('draft', 'published')),
	CONSTRAINT "articles_source_text_check" CHECK (octet_length("articles"."source_text") between 1 and 20480),
	CONSTRAINT "articles_body_check" CHECK (jsonb_typeof("articles"."body") = 'object' and octet_length("articles"."body"::text) <= 262144),
	CONSTRAINT "articles_revision_check" CHECK ("articles"."revision" >= 1 and "articles"."content_revision" >= 1),
	CONSTRAINT "articles_published_at_check" CHECK ("articles"."status" <> 'published' or "articles"."published_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "article_localizations" ADD CONSTRAINT "article_localizations_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_photo_files" ADD CONSTRAINT "article_photo_files_photo_id_article_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."article_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_photos" ADD CONSTRAINT "article_photos_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_recipes" ADD CONSTRAINT "article_recipes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_recipes" ADD CONSTRAINT "article_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_imports_created_at_idx" ON "article_imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "article_recipes_recipe_idx" ON "article_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
-- Ручная часть: байты фото уже сжаты — не пережимать (как recipe_photo_files, миграция 0007).
ALTER TABLE "article_photo_files" ALTER COLUMN "bytes" SET STORAGE EXTERNAL;
