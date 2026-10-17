-- Privileges for the finance tables. Row level security limits every
-- operation to the user's own rows.
REVOKE ALL ON TABLE public.accounts, public.categories, public.transactions,
  public.tags, public.transaction_tags FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accounts, public.categories,
  public.transactions, public.tags, public.transaction_tags TO authenticated;
--> statement-breakpoint

-- Current balance of each account. security_invoker makes the view run with
-- the caller's rights, so it only ever sees the caller's own rows.
CREATE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT
  a.id AS account_id,
  a.user_id,
  (a.opening_balance + coalesce(sum(
    CASE
      WHEN t.account_id = a.id AND t.kind = 'income' THEN t.amount
      WHEN t.account_id = a.id THEN -t.amount
      ELSE t.to_amount
    END
  ), 0))::bigint AS balance
FROM public.accounts a
LEFT JOIN public.transactions t
  ON t.account_id = a.id OR t.to_account_id = a.id
GROUP BY a.id;
--> statement-breakpoint
REVOKE ALL ON TABLE public.account_balances FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE public.account_balances TO authenticated;
--> statement-breakpoint

-- Default categories (keep in sync with DEFAULT_CATEGORIES in packages/core).
-- Names are translated in the app from system_key.
CREATE FUNCTION public.create_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item record;
  child text;
  parent uuid;
  position integer := 0;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('expense', 'groceries', ARRAY[]::text[]),
      ('expense', 'dining', ARRAY[]::text[]),
      ('expense', 'transport', ARRAY['fuel', 'public_transport', 'taxi']),
      ('expense', 'housing', ARRAY['rent', 'dues']),
      ('expense', 'bills', ARRAY['electricity', 'water', 'natural_gas', 'internet', 'phone']),
      ('expense', 'health', ARRAY[]::text[]),
      ('expense', 'shopping', ARRAY['clothing', 'electronics']),
      ('expense', 'entertainment', ARRAY[]::text[]),
      ('expense', 'subscriptions', ARRAY[]::text[]),
      ('expense', 'education', ARRAY[]::text[]),
      ('expense', 'personal_care', ARRAY[]::text[]),
      ('expense', 'gifts_donations', ARRAY[]::text[]),
      ('expense', 'other_expense', ARRAY[]::text[]),
      ('income', 'salary', ARRAY[]::text[]),
      ('income', 'side_income', ARRAY[]::text[]),
      ('income', 'investment_income', ARRAY[]::text[]),
      ('income', 'gifts_received', ARRAY[]::text[]),
      ('income', 'other_income', ARRAY[]::text[])
    ) AS v(kind, key, children)
  LOOP
    position := position + 1;
    INSERT INTO public.categories (user_id, kind, system_key, sort_order)
    VALUES (p_user_id, item.kind, item.key, position)
    ON CONFLICT DO NOTHING
    RETURNING id INTO parent;

    CONTINUE WHEN parent IS NULL;
    FOREACH child IN ARRAY item.children LOOP
      position := position + 1;
      INSERT INTO public.categories (user_id, kind, system_key, parent_id, sort_order)
      VALUES (p_user_id, item.kind, child, parent, position)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.create_default_categories(uuid) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, locale)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data ->> 'locale' IN ('tr', 'en')
        THEN NEW.raw_user_meta_data ->> 'locale'
      ELSE 'tr'
    END
  );
  PERFORM public.create_default_categories(NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Users who signed up before categories existed.
SELECT public.create_default_categories(id) FROM public.profiles;
