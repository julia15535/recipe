CREATE TABLE "recipe_photo_files" (
	"photo_id" uuid NOT NULL,
	"name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	CONSTRAINT "recipe_photo_files_photo_id_name_pk" PRIMARY KEY("photo_id","name"),
	CONSTRAINT "recipe_photo_files_name_check" CHECK ("recipe_photo_files"."name" in ('source', 'w480', 'w960', 'w1600', 'og')),
	CONSTRAINT "recipe_photo_files_type_check" CHECK ("recipe_photo_files"."content_type" in ('image/jpeg', 'image/webp')),
	CONSTRAINT "recipe_photo_files_size_check" CHECK ("recipe_photo_files"."width" between 1 and 4096 and "recipe_photo_files"."height" between 1 and 4096),
	CONSTRAINT "recipe_photo_files_bytes_check" CHECK (octet_length("recipe_photo_files"."bytes") between 1 and 1048576)
);
--> statement-breakpoint
CREATE TABLE "recipe_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"source_width" integer NOT NULL,
	"source_height" integer NOT NULL,
	"crop_left" integer NOT NULL,
	"crop_top" integer NOT NULL,
	"crop_width" integer NOT NULL,
	"crop_height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_photos_recipe_unique" UNIQUE("recipe_id"),
	CONSTRAINT "recipe_photos_source_check" CHECK ("recipe_photos"."source_width" between 1 and 4096 and "recipe_photos"."source_height" between 1 and 4096),
	CONSTRAINT "recipe_photos_crop_check" CHECK ("recipe_photos"."crop_left" >= 0 and "recipe_photos"."crop_top" >= 0 and "recipe_photos"."crop_width" >= 1 and "recipe_photos"."crop_height" >= 1
        and "recipe_photos"."crop_left" + "recipe_photos"."crop_width" <= "recipe_photos"."source_width" and "recipe_photos"."crop_top" + "recipe_photos"."crop_height" <= "recipe_photos"."source_height"
        and abs("recipe_photos"."crop_width" * 3 - "recipe_photos"."crop_height" * 4) <= 4)
);
--> statement-breakpoint
ALTER TABLE "recipe_photo_files" ADD CONSTRAINT "recipe_photo_files_photo_id_recipe_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."recipe_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_photos" ADD CONSTRAINT "recipe_photos_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Ручная часть (ADR-0028): JPEG/WebP уже сжаты — хранить вне строки без попытки TOAST-сжатия.
ALTER TABLE "recipe_photo_files" ALTER COLUMN "bytes" SET STORAGE EXTERNAL;
