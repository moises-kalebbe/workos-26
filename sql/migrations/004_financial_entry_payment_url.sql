ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS payment_url TEXT;
