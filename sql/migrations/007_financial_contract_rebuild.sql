WITH recurring_source AS (
  SELECT
    fe.*,
    CASE
      WHEN lower(coalesce(fe.counterparty_name, '')) = 'claude code' THEN 'Claude Code'
      WHEN lower(coalesce(fe.counterparty_name, '')) = 'golden belle' THEN 'Golden Belle'
      WHEN lower(coalesce(fe.counterparty_name, '')) = 'lu burger' THEN 'Lu Burger'
      WHEN lower(coalesce(fe.counterparty_name, '')) = 'rumo ao lucro' THEN 'Rumo ao Lucro'
      WHEN lower(coalesce(fe.counterparty_name, '')) = 'rumo à máxima potência' THEN 'Rumo à Máxima Potência'
      WHEN lower(coalesce(fe.counterparty_name, '')) IN ('astra numérica', 'astra numerica', 'astra') THEN 'AstraNumérica'
      ELSE NULL
    END AS canonical_counterparty,
    GREATEST(1, LEAST(31, EXTRACT(DAY FROM fe.due_date)::int)) AS due_day_key
  FROM financial_entries fe
  WHERE fe.recurrence IN ('monthly', 'yearly')
),
target_rows AS (
  SELECT *
  FROM recurring_source
  WHERE canonical_counterparty IS NOT NULL
),
cleared_entries AS (
  UPDATE financial_entries fe
  SET financial_contract_id = NULL
  FROM target_rows tr
  WHERE fe.id = tr.id
  RETURNING fe.id
),
deleted_contracts AS (
  DELETE FROM financial_contracts fc
  WHERE fc.counterparty_name IN ('Golden Belle', 'Lu Burger', 'Rumo ao Lucro', 'Rumo à Máxima Potência', 'AstraNumérica', 'Claude Code')
  RETURNING fc.id
),
contract_candidates AS (
  SELECT DISTINCT ON (
    tr.user_id,
    COALESCE(tr.project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    tr.type,
    tr.canonical_counterparty,
    tr.amount,
    tr.recurrence,
    tr.due_day_key
  )
    tr.user_id,
    tr.project_id,
    tr.type,
    tr.title AS name,
    tr.canonical_counterparty AS counterparty_name,
    COALESCE(NULLIF(tr.category, ''), 'Recorrente') AS category,
    tr.amount,
    tr.currency,
    tr.recurrence,
    tr.due_day_key AS due_day,
    COALESCE(tr.alert_days_before, 7) AS alert_days_before,
    MIN(COALESCE(tr.competency_date, tr.due_date)) OVER (
      PARTITION BY
        tr.user_id,
        tr.project_id,
        tr.type,
        tr.canonical_counterparty,
        tr.amount,
        tr.recurrence,
        tr.due_day_key
    ) AS start_date,
    NULL::date AS end_date,
    'active'::text AS status,
    tr.payment_url,
    COALESCE(tr.is_platform_cost, false) AS is_platform_cost,
    tr.notes
  FROM target_rows tr
  ORDER BY
    tr.user_id,
    COALESCE(tr.project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    tr.type,
    tr.canonical_counterparty,
    tr.amount,
    tr.recurrence,
    tr.due_day_key,
    tr.updated_at DESC
),
inserted_contracts AS (
  INSERT INTO financial_contracts (
    user_id,
    project_id,
    type,
    name,
    counterparty_name,
    category,
    amount,
    currency,
    recurrence,
    due_day,
    alert_days_before,
    start_date,
    end_date,
    status,
    payment_url,
    is_platform_cost,
    notes
  )
  SELECT
    cc.user_id,
    cc.project_id,
    cc.type,
    cc.name,
    cc.counterparty_name,
    cc.category,
    cc.amount,
    cc.currency,
    cc.recurrence,
    cc.due_day,
    cc.alert_days_before,
    cc.start_date,
    cc.end_date,
    cc.status,
    cc.payment_url,
    cc.is_platform_cost,
    cc.notes
  FROM contract_candidates cc
  RETURNING id, user_id, project_id, type, counterparty_name, amount, recurrence, due_day
),
relinked_entries AS (
  UPDATE financial_entries fe
  SET financial_contract_id = ic.id
  FROM target_rows tr
  JOIN inserted_contracts ic
    ON ic.user_id = tr.user_id
   AND ic.project_id IS NOT DISTINCT FROM tr.project_id
   AND ic.type = tr.type
   AND ic.counterparty_name = tr.canonical_counterparty
   AND ic.amount = tr.amount
   AND ic.recurrence = tr.recurrence
   AND ic.due_day = tr.due_day_key
  WHERE fe.id = tr.id
  RETURNING fe.id
)
SELECT
  (SELECT count(*) FROM inserted_contracts) AS rebuilt_contracts,
  (SELECT count(*) FROM relinked_entries) AS relinked_entries;

WITH duplicate_rows AS (
  SELECT
    fe.id,
    row_number() OVER (
      PARTITION BY fe.financial_contract_id, COALESCE(fe.competency_date, fe.due_date), fe.due_date
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
