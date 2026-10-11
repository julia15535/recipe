CREATE TABLE "article_translation_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
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
	CONSTRAINT "article_translation_jobs_locale_check" CHECK ("article_translation_jobs"."locale" = 'en'),
	CONSTRAINT "article_translation_jobs_status_check" CHECK ("article_translation_jobs"."status" in ('queued', 'running', 'done', 'failed')),
	CONSTRAINT "article_translation_jobs_attempts_check" CHECK ("article_translation_jobs"."attempts" between 0 and 3 and "article_translation_jobs"."source_content_revision" >= 1),
	CONSTRAINT "article_translation_jobs_running_check" CHECK ("article_translation_jobs"."status" <> 'running' or ("article_translation_jobs"."token" is not null and "article_translation_jobs"."lease_until" is not null)),
	CONSTRAINT "article_translation_jobs_input_check" CHECK (jsonb_typeof("article_translation_jobs"."input") = 'object' and octet_length("article_translation_jobs"."input"::text) <= 262144),
	CONSTRAINT "article_translation_jobs_error_check" CHECK ("article_translation_jobs"."error" is null or length("article_translation_jobs"."error") <= 200)
);
--> statement-breakpoint
CREATE TABLE "article_translations" (
	"article_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"body" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"source_content_revision" integer NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"translated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_translations_article_id_locale_pk" PRIMARY KEY("article_id","locale"),
	CONSTRAINT "article_translations_locale_check" CHECK ("article_translations"."locale" = 'en'),
	CONSTRAINT "article_translations_body_check" CHECK (jsonb_typeof("article_translations"."body") = 'object' and octet_length("article_translations"."body"::text) <= 262144),
	CONSTRAINT "article_translations_revision_check" CHECK ("article_translations"."source_content_revision" >= 1 and "article_translations"."schema_version" >= 1),
	CONSTRAINT "article_translations_meta_check" CHECK (length("article_translations"."model") between 1 and 100 and length("article_translations"."prompt_version") between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "article_translation_jobs" ADD CONSTRAINT "article_translation_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_article_id_locale_article_localizations_article_id_locale_fk" FOREIGN KEY ("article_id","locale") REFERENCES "public"."article_localizations"("article_id","locale") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_translation_jobs_active_unique" ON "article_translation_jobs" USING btree ("article_id","locale") WHERE "article_translation_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "article_translation_jobs_pick_idx" ON "article_translation_jobs" USING btree ("status","lease_until");--> statement-breakpoint
CREATE INDEX "article_translation_jobs_last_idx" ON "article_translation_jobs" USING btree ("article_id","locale","created_at");