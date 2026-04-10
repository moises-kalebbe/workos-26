WITH duplicate_rows AS (
  SELECT
    fe.id,
    row_number() OVER (
      PARTITION BY fe.financial_contract_id, fe.due_date, COALESCE(fe.competency_date, fe.due_date)
      ORDER BY
        CASE WHEN fe.status = 'paid' OR fe.paid_at IS NOT NULL THEN 0 ELSE 1 END,
        fe.paid_at DESC NULLS LAST,
        fe.created_at ASC,
        fe.id ASC
    ) AS row_rank
  FROM financial_entries fe
  WHERE fe.financial_contract_id IS NOT NULL
)
DELETE FROM financial_entries fe
USING duplicate_rows dr
WHERE fe.id = dr.id
  AND dr.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_entries_contract_period_unique
  ON financial_entries (
    financial_contract_id,
    due_date,
    COALESCE(competency_date, due_date)
  )
  WHERE financial_contract_id IS NOT NULL;
