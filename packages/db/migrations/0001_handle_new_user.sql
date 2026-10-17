-- Create a profile row whenever a user signs up. The sign-up form passes the
-- interface language as user metadata; anything unexpected falls back to 'tr'.
CREATE FUNCTION public.handle_new_user()
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
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
