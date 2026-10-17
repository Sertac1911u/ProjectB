-- Deleting a rule keeps the transactions it created; only the link goes.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurring_rule_fk
  FOREIGN KEY (recurring_rule_id, user_id)
  REFERENCES public.recurring_rules (id, user_id)
  ON DELETE SET NULL (recurring_rule_id);
--> statement-breakpoint
CREATE INDEX transactions_recurring_rule_id_idx ON public.transactions (recurring_rule_id);
--> statement-breakpoint
REVOKE ALL ON TABLE public.recurring_rules FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recurring_rules TO authenticated;
--> statement-breakpoint

-- Date of occurrence k (0-based) of a schedule, counted from its start so
-- that monthly schedules on the 31st return to the 31st after short months.
-- Keep in sync with occurrenceDate() in packages/core/src/recurring.ts.
CREATE FUNCTION public.recurring_date(start_on date, frequency text, interval_count integer, k integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE frequency
    WHEN 'weekly' THEN start_on + 7 * interval_count * k
    WHEN 'monthly' THEN (start_on + make_interval(months => interval_count * k))::date
    WHEN 'yearly' THEN (start_on + make_interval(years => interval_count * k))::date
  END
$$;
--> statement-breakpoint

-- Creates the transactions of the signed-in user's recurring rules that are
-- due on or before p_today, including any missed while the app was not used,
-- and returns how many were created. Runs with the caller's rights, so row
-- level security limits it to the caller's own rules. Safe to call at the
-- same time from several places: rules are locked while processed, and the
-- unique (recurring_rule_id, occurred_on) index stops duplicates.
CREATE FUNCTION public.materialize_recurring(p_today date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  r public.recurring_rules;
  k integer;
  d date;
  new_id uuid;
  created integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.recurring_rules
    WHERE NOT paused AND NOT finished AND next_on <= p_today
    ORDER BY next_on
    FOR UPDATE SKIP LOCKED
  LOOP
    k := r.occurrences;
    d := r.next_on;
    WHILE d <= p_today
      AND (r.max_occurrences IS NULL OR k < r.max_occurrences)
      AND (r.end_on IS NULL OR d <= r.end_on)
      AND created < 1000
    LOOP
      INSERT INTO public.transactions
        (user_id, kind, account_id, to_account_id, amount, to_amount, category_id,
         occurred_on, note, recurring_rule_id)
      VALUES
        (r.user_id, r.kind, r.account_id, r.to_account_id, r.amount, r.to_amount,
         r.category_id, d, r.note, r.id)
      ON CONFLICT (recurring_rule_id, occurred_on) WHERE recurring_rule_id IS NOT NULL
        DO NOTHING
      RETURNING id INTO new_id;

      IF new_id IS NOT NULL AND cardinality(r.tag_names) > 0 THEN
        INSERT INTO public.tags (user_id, name)
        SELECT r.user_id, n FROM unnest(r.tag_names) AS n
        ON CONFLICT (user_id, lower(name)) DO NOTHING;
        INSERT INTO public.transaction_tags (transaction_id, tag_id, user_id)
        SELECT new_id, t.id, r.user_id FROM public.tags t
        WHERE lower(t.name) IN (SELECT lower(n) FROM unnest(r.tag_names) AS n)
        ON CONFLICT DO NOTHING;
      END IF;
      IF new_id IS NOT NULL THEN
        created := created + 1;
      END IF;
      new_id := NULL;

      k := k + 1;
      d := public.recurring_date(r.start_on, r.frequency, r.interval_count, k);
    END LOOP;

    UPDATE public.recurring_rules SET
      occurrences = k,
      next_on = d,
      finished = (r.max_occurrences IS NOT NULL AND k >= r.max_occurrences)
        OR (r.end_on IS NOT NULL AND d > r.end_on),
      updated_at = now()
    WHERE id = r.id;
  END LOOP;
  RETURN created;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.materialize_recurring(date) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.materialize_recurring(date) TO authenticated;
