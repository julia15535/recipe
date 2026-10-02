CREATE TABLE "recipe_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"original_text" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_imports_original_text_check" CHECK (octet_length("recipe_imports"."original_text") between 1 and 20480)
);
--> statement-breakpoint
CREATE TABLE "recipe_tips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "recipe_tips_position_unique" UNIQUE("recipe_id","position"),
	CONSTRAINT "recipe_tips_position_check" CHECK ("recipe_tips"."position" >= 0),
	CONSTRAINT "recipe_tips_text_check" CHECK (length("recipe_tips"."text") between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "original_text" text;--> statement-breakpoint
ALTER TABLE "recipe_tips" ADD CONSTRAINT "recipe_tips_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_imports_created_at_idx" ON "recipe_imports" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_original_text_check" CHECK ("recipes"."original_text" is null or octet_length("recipes"."original_text") between 1 and 20480);