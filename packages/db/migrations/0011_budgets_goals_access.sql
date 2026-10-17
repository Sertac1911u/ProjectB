-- Deleting an account keeps the goals that followed it; they fall back to
-- contributions.
ALTER TABLE public.goals
  ADD CONSTRAINT goals_account_fk
  FOREIGN KEY (account_id, user_id)
  REFERENCES public.accounts (id, user_id)
  ON DELETE SET NULL (account_id);
--> statement-breakpoint
REVOKE ALL ON TABLE public.budgets, public.goals, public.goal_contributions FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.budgets, public.goals, public.goal_contributions TO authenticated;
