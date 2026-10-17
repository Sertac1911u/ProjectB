CREATE TABLE "envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"start_on" date NOT NULL,
	"due_on" date NOT NULL,
	"interval_months" smallint,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "envelopes_name_check" CHECK (char_length("envelopes"."name") between 1 and 60),
	CONSTRAINT "envelopes_amount_check" CHECK ("envelopes"."amount" > 0),
	CONSTRAINT "envelopes_currency_check" CHECK ("envelopes"."currency" in ('TRY', 'USD', 'EUR', 'GBP')),
	CONSTRAINT "envelopes_dates_check" CHECK ("envelopes"."due_on" >= "envelopes"."start_on"),
	CONSTRAINT "envelopes_interval_check" CHECK ("envelopes"."interval_months" between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "envelopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "envelopes_user_id_idx" ON "envelopes" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "envelopes_own_rows" ON "envelopes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_id" = (select auth.uid())) WITH CHECK ("user_id" = (select auth.uid()));--> statement-breakpoint
REVOKE ALL ON TABLE public.envelopes FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.envelopes TO authenticated;
