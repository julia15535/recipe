CREATE TABLE "owner_login_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_hash" "bytea" NOT NULL,
	"binding_hash" "bytea" NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"ip_hash" "bytea" NOT NULL,
	"telegram_id" bigint,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "owner_login_challenges_challenge_hash_unique" UNIQUE("challenge_hash"),
	CONSTRAINT "owner_login_challenges_binding_hash_unique" UNIQUE("binding_hash"),
	CONSTRAINT "owner_login_challenges_status_check" CHECK ("owner_login_challenges"."status" in ('pending', 'confirmed', 'rejected', 'consumed', 'cancelled')),
	CONSTRAINT "owner_login_challenges_code_check" CHECK ("owner_login_challenges"."code" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "owner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"telegram_id" bigint NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "owner_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "telegram_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "owner_login_challenges_ip_created_idx" ON "owner_login_challenges" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "owner_login_challenges_expires_at_idx" ON "owner_login_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "owner_sessions_expires_at_idx" ON "owner_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "telegram_updates_received_at_idx" ON "telegram_updates" USING btree ("received_at");