ALTER TABLE "accounts" ADD COLUMN "credit_limit" bigint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "statement_day" smallint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "due_day" smallint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "min_payment_rate" smallint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "installment_count" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_card_settings_check" CHECK ("accounts"."type" = 'credit_card' or ("accounts"."credit_limit" is null and "accounts"."statement_day" is null
        and "accounts"."due_day" is null and "accounts"."min_payment_rate" is null));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_credit_limit_check" CHECK ("accounts"."credit_limit" >= 0);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_statement_day_check" CHECK ("accounts"."statement_day" between 1 and 31);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_due_day_check" CHECK ("accounts"."due_day" between 1 and 31);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_min_payment_rate_check" CHECK ("accounts"."min_payment_rate" between 0 and 100);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installment_count_check" CHECK ("transactions"."installment_count" between 1 and 36
        and ("transactions"."installment_count" = 1 or "transactions"."kind" = 'expense'));