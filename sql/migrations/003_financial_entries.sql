CREATE TABLE IF NOT EXISTS financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  financial_contract_id UUID,
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
  is_platform_cost BOOLEAN NOT NULL DEFAULT FALSE,
  payment_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_due_date
  ON financial_entries(user_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_status
  ON financial_entries(user_id, status);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_project
  ON financial_entries(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_contract
  ON financial_entries(user_id, financial_contract_id);

DROP TRIGGER IF EXISTS tr_financial_entries_updated ON financial_entries;
CREATE TRIGGER tr_financial_entries_updated
  BEFORE UPDATE ON financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
