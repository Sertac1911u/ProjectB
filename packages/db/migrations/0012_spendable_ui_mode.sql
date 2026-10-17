ALTER TABLE "accounts" ADD COLUMN "spendable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ui_mode" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_ui_mode_check" CHECK ("profiles"."ui_mode" in ('simple', 'detailed'));--> statement-breakpoint
-- Savings accounts and cards are not money to spend unless the user says so.
UPDATE public.accounts SET spendable = type IN ('cash', 'bank');
--> statement-breakpoint
GRANT UPDATE (ui_mode) ON TABLE public.profiles TO authenticated;
