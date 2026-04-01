WITH normalized_entries AS (
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
    END AS canonical_name
  FROM financial_entries fe
  WHERE fe.recurrence IN ('monthly', 'yearly')
),
recurring_candidates AS (
  SELECT DISTINCT ON (
    ne.user_id,
    COALESCE(ne.project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    ne.type,
    ne.canonical_name
    ,
    ne.amount,
    ne.recurrence,
    GREATEST(1, LEAST(31, EXTRACT(DAY FROM ne.due_date)::int))
  )
    ne.user_id,
    ne.project_id,
    ne.type,
    ne.title AS name,
    ne.canonical_name AS counterparty_name,
    COALESCE(NULLIF(ne.category, ''), 'Recorrente') AS category,
    ne.amount,
    ne.currency,
    ne.recurrence,
    GREATEST(1, LEAST(31, EXTRACT(DAY FROM ne.due_date)::int)) AS due_day,
    COALESCE(ne.alert_days_before, 7) AS alert_days_before,
    MIN(COALESCE(ne.competency_date, ne.due_date)) OVER (
      PARTITION BY ne.user_id, ne.project_id, ne.type, ne.canonical_name
    ) AS start_date,
    ne.payment_url,
    COALESCE(ne.is_platform_cost, false) AS is_platform_cost,
    ne.notes
  FROM normalized_entries ne
  WHERE ne.canonical_name IS NOT NULL
  ORDER BY
    ne.user_id,
    COALESCE(ne.project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    ne.type,
    ne.canonical_name,
    ne.amount,
    ne.recurrence,
    GREATEST(1, LEAST(31, EXTRACT(DAY FROM ne.due_date)::int)),
    ne.updated_at DESC
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
    candidate.user_id,
    candidate.project_id,
    candidate.type,
    candidate.name,
    candidate.counterparty_name,
    candidate.category,
    candidate.amount,
    candidate.currency,
    candidate.recurrence,
    candidate.due_day,
    candidate.alert_days_before,
    candidate.start_date,
    NULL,
    'active',
    candidate.payment_url,
    candidate.is_platform_cost,
    candidate.notes
  FROM recurring_candidates candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM financial_contracts fc
    WHERE fc.user_id = candidate.user_id
      AND fc.project_id IS NOT DISTINCT FROM candidate.project_id
      AND fc.type = candidate.type
      AND fc.counterparty_name = candidate.counterparty_name
      AND fc.amount = candidate.amount
      AND fc.recurrence = candidate.recurrence
      AND fc.due_day = candidate.due_day
  )
  RETURNING id, user_id, project_id, type, counterparty_name, amount, recurrence, due_day
),
all_contracts AS (
  SELECT id, user_id, project_id, type, counterparty_name, amount, recurrence, due_day FROM inserted_contracts
  UNION ALL
  SELECT fc.id, fc.user_id, fc.project_id, fc.type, fc.counterparty_name, fc.amount, fc.recurrence, fc.due_day
  FROM financial_contracts fc
  WHERE fc.counterparty_name IN ('Golden Belle', 'Lu Burger', 'Rumo ao Lucro', 'Rumo à Máxima Potência', 'AstraNumérica', 'Claude Code')
),
normalized_updates AS (
  SELECT
    ne.id,
    ne.user_id,
    ne.project_id,
    ne.type,
    ne.canonical_name,
    ne.amount,
    ne.recurrence,
    GREATEST(1, LEAST(31, EXTRACT(DAY FROM ne.due_date)::int)) AS due_day
  FROM normalized_entries ne
  WHERE ne.canonical_name IS NOT NULL
)
UPDATE financial_entries fe
SET financial_contract_id = contract.id
FROM normalized_updates source
JOIN all_contracts contract
  ON contract.user_id = source.user_id
 AND contract.project_id IS NOT DISTINCT FROM source.project_id
 AND contract.type = source.type
 AND contract.counterparty_name = source.canonical_name
 AND contract.amount = source.amount
 AND contract.recurrence = source.recurrence
 AND contract.due_day = source.due_day
WHERE fe.id = source.id
  AND fe.financial_contract_id IS NULL;
