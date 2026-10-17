-- Deletes everything the signed-in user has entered and restores the
-- default categories, as if they had just signed up. Their sign-in and
-- profile settings stay; the interface question is asked again.
CREATE FUNCTION public.reset_own_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  DELETE FROM public.envelopes WHERE user_id = uid;
  DELETE FROM public.goals WHERE user_id = uid;
  DELETE FROM public.transactions WHERE user_id = uid;
  DELETE FROM public.recurring_rules WHERE user_id = uid;
  DELETE FROM public.accounts WHERE user_id = uid;
  DELETE FROM public.tags WHERE user_id = uid;
  DELETE FROM public.categories WHERE user_id = uid;
  UPDATE public.profiles SET ui_mode = NULL WHERE id = uid;
  PERFORM public.create_default_categories(uid);
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.reset_own_data() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.reset_own_data() TO authenticated;
--> statement-breakpoint

-- Deletes the signed-in user; every table cascades from auth.users.
CREATE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
