CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"kind" text NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"amount" bigint NOT NULL,
	"to_amount" bigint,
	"category_id" uuid,
	"note" text,
	"tag_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"start_on" date NOT NULL,
	"frequency" text NOT NULL,
	"interval_count" smallint DEFAULT 1 NOT NULL,
	"end_on" date,
	"max_occurrences" smallint,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"next_on" date NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"finished" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_rules_id_user_id_key" UNIQUE("id","user_id"),
	CONSTRAINT "recurring_rules_kind_check" CHECK ("recurring_rules"."kind" in ('expense', 'income', 'transfer')),
	CONSTRAINT "recurring_rules_amount_check" CHECK ("recurring_rules"."amount" > 0),
	CONSTRAINT "recurring_rules_transfer_check" CHECK (case when "recurring_rules"."kind" = 'transfer'
        then "recurring_rules"."to_account_id" is not null and "recurring_rules"."to_account_id" <> "recurring_rules"."account_id"
          and "recurring_rules"."to_amount" is not null and "recurring_rules"."to_amount" > 0 and "recurring_rules"."category_id" is null
        else "recurring_rules"."to_account_id" is null and "recurring_rules"."to_amount" is null end),
	CONSTRAINT "recurring_rules_frequency_check" CHECK ("recurring_rules"."frequency" in ('weekly', 'monthly', 'yearly')),
	CONSTRAINT "recurring_rules_interval_check" CHECK ("recurring_rules"."interval_count" between 1 and 12),
	CONSTRAINT "recurring_rules_max_occurrences_check" CHECK ("recurring_rules"."max_occurrences" between 1 and 360),
	CONSTRAINT "recurring_rules_end_on_check" CHECK ("recurring_rules"."end_on" >= "recurring_rules"."start_on"),
	CONSTRAINT "recurring_rules_note_check" CHECK (char_length("recurring_rules"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "recurring_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurring_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_to_account_fk" FOREIGN KEY ("to_account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_rules_user_id_next_on_idx" ON "recurring_rules" USING btree ("user_id","next_on");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_recurring_rule_id_occurred_on_idx" ON "transactions" USING btree ("recurring_rule_id","occurred_on") WHERE "transactions"."recurring_rule_id" is not null;--> statement-breakpoint
CREATE POLICY "recurring_rules_own_rows" ON "recurring_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_id" = (select auth.uid())) WITH CHECK ("user_id" = (select auth.uid()));