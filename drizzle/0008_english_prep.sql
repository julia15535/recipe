CREATE TABLE "recipe_translation_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"token" uuid,
	"lease_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"input" jsonb NOT NULL,
	"source_content_revision" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"revalidated_at" timestamp with time zone,
	CONSTRAINT "recipe_translation_jobs_locale_check" CHECK ("recipe_translation_jobs"."locale" = 'en'),
	CONSTRAINT "recipe_translation_jobs_status_check" CHECK ("recipe_translation_jobs"."status" in ('queued', 'running', 'done', 'failed')),
	CONSTRAINT "recipe_translation_jobs_input_check" CHECK (jsonb_typeof("recipe_translation_jobs"."input") = 'object' and pg_column_size("recipe_translation_jobs"."input") <= 262144),
	CONSTRAINT "recipe_translation_jobs_error_check" CHECK ("recipe_translation_jobs"."error" is null or length("recipe_translation_jobs"."error") <= 200)
);
--> statement-breakpoint
CREATE TABLE "recipe_translations" (
	"recipe_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"body" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"source_content_revision" integer NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"translated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_translations_recipe_id_locale_pk" PRIMARY KEY("recipe_id","locale"),
	CONSTRAINT "recipe_translations_locale_check" CHECK ("recipe_translations"."locale" = 'en'),
	CONSTRAINT "recipe_translations_body_check" CHECK (jsonb_typeof("recipe_translations"."body") = 'object' and pg_column_size("recipe_translations"."body") <= 262144),
	CONSTRAINT "recipe_translations_revision_check" CHECK ("recipe_translations"."source_content_revision" >= 1 and "recipe_translations"."schema_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "recipe_localizations" DROP CONSTRAINT "recipe_localizations_yield_forms_check";--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "content_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_translation_jobs" ADD CONSTRAINT "recipe_translation_jobs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_translations" ADD CONSTRAINT "recipe_translations_recipe_id_locale_recipe_localizations_recipe_id_locale_fk" FOREIGN KEY ("recipe_id","locale") REFERENCES "public"."recipe_localizations"("recipe_id","locale") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_translation_jobs_active_unique" ON "recipe_translation_jobs" USING btree ("recipe_id","locale") WHERE "recipe_translation_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "recipe_translation_jobs_pick_idx" ON "recipe_translation_jobs" USING btree ("status","lease_until");--> statement-breakpoint
ALTER TABLE "recipe_localizations" ADD CONSTRAINT "recipe_localizations_yield_forms_check" CHECK ("recipe_localizations"."yield_forms" is null or ("recipe_localizations"."locale" = 'ru' and cardinality("recipe_localizations"."yield_forms") = 3) or ("recipe_localizations"."locale" = 'en' and cardinality("recipe_localizations"."yield_forms") = 2));--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_content_revision_check" CHECK ("recipes"."content_revision" >= 1);--> statement-breakpoint
-- Ручная часть (ADR-0029): английский каталог по постоянным кодам — названия и адреса показаны владельцу 03.10.
INSERT INTO "section_localizations" ("section_id", "locale", "label", "slug") VALUES
  ('04bf0a8d-6bfe-5558-b004-278dcbe4814f', 'en', 'Breakfast', 'breakfast'),
  ('772f6642-7c1b-5156-9661-2b9941b74af9', 'en', 'Soups', 'soups'),
  ('c90b53ba-b0c0-5121-b781-96d7e0ef5404', 'en', 'Salads', 'salads'),
  ('d1ced612-d7d1-5dbe-a7c1-98b77b3ab302', 'en', 'Mains', 'mains'),
  ('fa21ab53-16ce-5c3b-b646-27600c45545c', 'en', 'Sides', 'sides'),
  ('3f5aa167-db3c-5a6d-b947-9b69f353dedf', 'en', 'Starters', 'starters'),
  ('ed6933e1-8b7c-564a-bdc1-8269afddf04b', 'en', 'Baking', 'baking'),
  ('fc0d4155-1c5c-55af-b679-aa5d8297cf50', 'en', 'Desserts', 'desserts'),
  ('6f804aca-e91a-5373-acf4-b89291380e55', 'en', 'Sauces', 'sauces'),
  ('96ad0193-c664-5745-9df3-1bc17ecc94e6', 'en', 'Drinks', 'drinks'),
  ('4cc872f8-1d5f-51df-a98b-1aca19551c99', 'en', 'Preserves', 'preserves')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "composition_tag_localizations" ("tag_id", "locale", "label") VALUES
  ('24ca9069-d1f5-5376-b601-2454976ab926', 'en', 'Protein'),
  ('047a54c2-c35e-54ec-8f91-6ae7744fcd95', 'en', 'Fibre'),
  ('1e7c179c-e26c-5afc-947e-d546feba0b32', 'en', 'Healthy fats'),
  ('b39546fe-89b1-5d3a-bf26-ce0c3441cd90', 'en', 'Low sugar'),
  ('2507b851-573f-5a95-adf6-36933849c4a3', 'en', 'Iron')
ON CONFLICT DO NOTHING;
