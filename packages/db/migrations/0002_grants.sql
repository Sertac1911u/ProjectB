-- Explicit table privileges, so access does not depend on the Supabase project
-- setting "Automatically expose new tables". Row level security still decides
-- which rows a user sees; these grants decide which operations are possible.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE public.profiles TO authenticated;
--> statement-breakpoint
GRANT UPDATE (display_name, locale, base_currency, updated_at) ON TABLE public.profiles TO authenticated;
