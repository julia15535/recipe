CREATE TABLE "composition_tag_localizations" (
	"tag_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "composition_tag_localizations_tag_id_locale_pk" PRIMARY KEY("tag_id","locale"),
	CONSTRAINT "composition_tag_localizations_locale_check" CHECK ("composition_tag_localizations"."locale" in ('ru', 'en'))
);
--> statement-breakpoint
CREATE TABLE "composition_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "composition_tags_code_unique" UNIQUE("code"),
	CONSTRAINT "composition_tags_code_check" CHECK ("composition_tags"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "composition_tags_position_check" CHECK ("composition_tags"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "section_localizations" (
	"section_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "section_localizations_section_id_locale_pk" PRIMARY KEY("section_id","locale"),
	CONSTRAINT "section_localizations_locale_slug_unique" UNIQUE("locale","slug"),
	CONSTRAINT "section_localizations_locale_check" CHECK ("section_localizations"."locale" in ('ru', 'en')),
	CONSTRAINT "section_localizations_slug_check" CHECK ("section_localizations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"parent_id" uuid,
	"position" integer NOT NULL,
	CONSTRAINT "sections_code_unique" UNIQUE("code"),
	CONSTRAINT "sections_code_check" CHECK ("sections"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "sections_position_check" CHECK ("sections"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"display_name" text NOT NULL,
	"quantity_kind" text NOT NULL,
	"amount_num" bigint,
	"amount_den" integer,
	"amount_max_num" bigint,
	"amount_max_den" integer,
	"unit" text,
	"note" text,
	CONSTRAINT "recipe_ingredients_position_unique" UNIQUE("recipe_id","position"),
	CONSTRAINT "recipe_ingredients_recipe_id_unique" UNIQUE("recipe_id","id"),
	CONSTRAINT "recipe_ingredients_position_check" CHECK ("recipe_ingredients"."position" >= 0),
	CONSTRAINT "recipe_ingredients_name_check" CHECK (length("recipe_ingredients"."display_name") between 1 and 200),
	CONSTRAINT "recipe_ingredients_unit_check" CHECK ("recipe_ingredients"."unit" is null or length("recipe_ingredients"."unit") between 1 and 30),
	CONSTRAINT "recipe_ingredients_note_check" CHECK ("recipe_ingredients"."note" is null or length("recipe_ingredients"."note") between 1 and 300),
	CONSTRAINT "recipe_ingredients_amount_bounds_check" CHECK (coalesce("recipe_ingredients"."amount_num", 1) between 1 and 1000000000000000 and coalesce("recipe_ingredients"."amount_den", 1) between 1 and 1000000
        and coalesce("recipe_ingredients"."amount_max_num", 1) between 1 and 1000000000000000 and coalesce("recipe_ingredients"."amount_max_den", 1) between 1 and 1000000),
	CONSTRAINT "recipe_ingredients_quantity_check" CHECK (("recipe_ingredients"."quantity_kind" = 'exact' and "recipe_ingredients"."amount_num" is not null and "recipe_ingredients"."amount_den" is not null
          and "recipe_ingredients"."amount_max_num" is null and "recipe_ingredients"."amount_max_den" is null)
        or ("recipe_ingredients"."quantity_kind" = 'range' and "recipe_ingredients"."amount_num" is not null and "recipe_ingredients"."amount_den" is not null
          and "recipe_ingredients"."amount_max_num" is not null and "recipe_ingredients"."amount_max_den" is not null
          and "recipe_ingredients"."amount_num"::numeric * "recipe_ingredients"."amount_max_den" <= "recipe_ingredients"."amount_max_num"::numeric * "recipe_ingredients"."amount_den")
        or ("recipe_ingredients"."quantity_kind" = 'none' and "recipe_ingredients"."amount_num" is null and "recipe_ingredients"."amount_den" is null
          and "recipe_ingredients"."amount_max_num" is null and "recipe_ingredients"."amount_max_den" is null and "recipe_ingredients"."note" is not null))
);
--> statement-breakpoint
CREATE TABLE "recipe_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "recipe_steps_position_unique" UNIQUE("recipe_id","position"),
	CONSTRAINT "recipe_steps_position_check" CHECK ("recipe_steps"."position" >= 0),
	CONSTRAINT "recipe_steps_text_check" CHECK (length("recipe_steps"."text") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "recipe_composition_tags" (
	"recipe_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "recipe_composition_tags_recipe_id_tag_id_pk" PRIMARY KEY("recipe_id","tag_id"),
	CONSTRAINT "recipe_composition_tags_position_unique" UNIQUE("recipe_id","position"),
	CONSTRAINT "recipe_composition_tags_position_check" CHECK ("recipe_composition_tags"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_localizations" (
	"recipe_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"time_text" text,
	"yield_forms" text[],
	CONSTRAINT "recipe_localizations_recipe_id_locale_pk" PRIMARY KEY("recipe_id","locale"),
	CONSTRAINT "recipe_localizations_locale_slug_unique" UNIQUE("locale","slug"),
	CONSTRAINT "recipe_localizations_locale_check" CHECK ("recipe_localizations"."locale" in ('ru', 'en')),
	CONSTRAINT "recipe_localizations_slug_check" CHECK ("recipe_localizations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("recipe_localizations"."slug") <= 80),
	CONSTRAINT "recipe_localizations_title_check" CHECK (length("recipe_localizations"."title") between 1 and 120),
	CONSTRAINT "recipe_localizations_yield_forms_check" CHECK ("recipe_localizations"."yield_forms" is null or cardinality("recipe_localizations"."yield_forms") = 3)
);
--> statement-breakpoint
CREATE TABLE "recipe_sections" (
	"recipe_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "recipe_sections_recipe_id_section_id_pk" PRIMARY KEY("recipe_id","section_id"),
	CONSTRAINT "recipe_sections_position_unique" UNIQUE("recipe_id","position"),
	CONSTRAINT "recipe_sections_position_check" CHECK ("recipe_sections"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_text" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"main_ingredient_id" uuid NOT NULL,
	"primary_section_id" uuid NOT NULL,
	"yield_num" bigint,
	"yield_den" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "recipes_status_check" CHECK ("recipes"."status" in ('draft', 'published')),
	CONSTRAINT "recipes_source_text_check" CHECK (octet_length("recipes"."source_text") between 1 and 20480),
	CONSTRAINT "recipes_revision_check" CHECK ("recipes"."revision" >= 1),
	CONSTRAINT "recipes_yield_check" CHECK (("recipes"."yield_num" is null and "recipes"."yield_den" is null) or ("recipes"."yield_num" > 0 and "recipes"."yield_den" between 1 and 1000000)),
	CONSTRAINT "recipes_published_at_check" CHECK ("recipes"."status" <> 'published' or "recipes"."published_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "composition_tag_localizations" ADD CONSTRAINT "composition_tag_localizations_tag_id_composition_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."composition_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_localizations" ADD CONSTRAINT "section_localizations_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_composition_tags" ADD CONSTRAINT "recipe_composition_tags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_composition_tags" ADD CONSTRAINT "recipe_composition_tags_tag_id_composition_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."composition_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_localizations" ADD CONSTRAINT "recipe_localizations_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_sections" ADD CONSTRAINT "recipe_sections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_sections" ADD CONSTRAINT "recipe_sections_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_composition_tags_tag_idx" ON "recipe_composition_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "recipe_sections_section_idx" ON "recipe_sections" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "recipes_status_updated_idx" ON "recipes" USING btree ("status","updated_at");