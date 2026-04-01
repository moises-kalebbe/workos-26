CREATE TABLE IF NOT EXISTS financial_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  name TEXT NOT NULL,
  counterparty_name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('none', 'monthly', 'yearly')),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  alert_days_before INTEGER NOT NULL DEFAULT 7 CHECK (alert_days_before >= 0 AND alert_days_before <= 365),
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  payment_url TEXT,
  is_platform_cost BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_contracts_user_status
  ON financial_contracts(user_id, status);

CREATE INDEX IF NOT EXISTS idx_financial_contracts_user_project
  ON financial_contracts(user_id, project_id);

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS financial_contract_id UUID REFERENCES financial_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_contract
  ON financial_entries(user_id, financial_contract_id);

DROP TRIGGER IF EXISTS tr_financial_contracts_updated ON financial_contracts;
CREATE TRIGGER tr_financial_contracts_updated
  BEFORE UPDATE ON financial_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
