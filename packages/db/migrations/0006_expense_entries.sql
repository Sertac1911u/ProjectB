-- Expenses spread over the months they are paid in, for budgets and reports.
-- An installment purchase yields one row per installment, dated one month
-- apart from the purchase date (Postgres moves 31 Jan + 1 month to 28 Feb).
-- Amounts are split like installmentAmounts() in packages/core: leftover
-- minor units go to the first installments.
CREATE VIEW public.expense_entries WITH (security_invoker = true) AS
SELECT
  t.id AS transaction_id,
  t.user_id,
  t.account_id,
  t.category_id,
  (t.occurred_on + make_interval(months => k - 1))::date AS entry_on,
  (t.amount / t.installment_count
    + CASE WHEN k <= t.amount % t.installment_count THEN 1 ELSE 0 END)::bigint AS amount,
  k AS installment_number,
  t.installment_count
FROM public.transactions t
CROSS JOIN LATERAL generate_series(1, t.installment_count) AS k
WHERE t.kind = 'expense';
--> statement-breakpoint
REVOKE ALL ON TABLE public.expense_entries FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE public.expense_entries TO authenticated;
