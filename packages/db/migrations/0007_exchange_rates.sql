CREATE TABLE "exchange_rates" (
	"rate_on" date NOT NULL,
	"currency" text NOT NULL,
	"try_per_unit" numeric(20, 8) NOT NULL,
	CONSTRAINT "exchange_rates_rate_on_currency_pk" PRIMARY KEY("rate_on","currency"),
	CONSTRAINT "exchange_rates_positive_check" CHECK ("exchange_rates"."try_per_unit" > 0)
);
--> statement-breakpoint
ALTER TABLE "exchange_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "exchange_rates_read" ON "exchange_rates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
REVOKE ALL ON TABLE public.exchange_rates FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE public.exchange_rates TO authenticated;
