ALTER TABLE "accounts" DROP CONSTRAINT "accounts_type_check";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "interest_rate_bp" smallint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "loan_payment" bigint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "gold_unit" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "gold_quantity" bigint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "unit_price" bigint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "price_on" date;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_interest_rate_check" CHECK ("accounts"."interest_rate_bp" is null or ("accounts"."type" in ('credit_card', 'loan')
        and "accounts"."interest_rate_bp" between 0 and 10000));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_loan_check" CHECK ("accounts"."loan_payment" is null or ("accounts"."type" = 'loan' and "accounts"."loan_payment" > 0));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_gold_check" CHECK (case when "accounts"."type" = 'gold'
        then "accounts"."gold_unit" in ('gram', 'quarter', 'half', 'full') and "accounts"."gold_quantity" >= 0
          and "accounts"."unit_price" > 0 and "accounts"."price_on" is not null
        else "accounts"."gold_unit" is null and "accounts"."gold_quantity" is null
          and "accounts"."unit_price" is null and "accounts"."price_on" is null end);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('cash', 'bank', 'credit_card', 'savings', 'loan', 'gold'));