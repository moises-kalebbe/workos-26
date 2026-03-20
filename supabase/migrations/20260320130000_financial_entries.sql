BEGIN;

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  counterparty_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  competency_date DATE,
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'monthly', 'yearly')),
  alert_days_before INTEGER NOT NULL DEFAULT 7 CHECK (alert_days_before >= 0 AND alert_days_before <= 365),
  is_platform_cost BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_due_date
  ON public.financial_entries(user_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_status
  ON public.financial_entries(user_id, status);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_project
  ON public.financial_entries(user_id, project_id);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial entries own data"
  ON public.financial_entries
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS tr_financial_entries_updated ON public.financial_entries;
CREATE TRIGGER tr_financial_entries_updated
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMIT;
