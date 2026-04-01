WITH recurring_candidates AS (
  SELECT DISTINCT ON (fe.user_id, COALESCE(fe.project_id, '00000000-0000-0000-0000-000000000000'::uuid), fe.type, fe.title)
    fe.user_id,
    fe.project_id,
    fe.type,
    fe.title AS name,
    fe.counterparty_name,
    fe.category,
    fe.amount,
    fe.currency,
    fe.recurrence,
    GREATEST(1, LEAST(31, EXTRACT(DAY FROM fe.due_date)::int)) AS due_day,
    COALESCE(fe.alert_days_before, 7) AS alert_days_before,
    MIN(COALESCE(fe.competency_date, fe.due_date)) OVER (
      PARTITION BY fe.user_id, fe.project_id, fe.type, fe.title
    ) AS start_date,
    CASE WHEN fe.status = 'paid' THEN 'inactive' ELSE 'active' END AS status,
    fe.payment_url,
    COALESCE(fe.is_platform_cost, false) AS is_platform_cost,
    fe.notes
  FROM financial_entries fe
  WHERE fe.recurrence IN ('monthly', 'yearly')
    AND fe.title IN (
      'Golden Belle',
      'Lu Burger',
      'Rumo ao Lucro',
      'Rumo à Máxima Potência',
      'AstraNumérica',
      'Claude Code'
    )
  ORDER BY
    fe.user_id,
    COALESCE(fe.project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fe.type,
    fe.title,
    fe.updated_at DESC
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
      AND fc.name = candidate.name
  )
  RETURNING id, user_id, project_id, type, name
),
all_contracts AS (
  SELECT id, user_id, project_id, type, name FROM inserted_contracts
  UNION ALL
  SELECT fc.id, fc.user_id, fc.project_id, fc.type, fc.name
  FROM financial_contracts fc
  WHERE fc.name IN (
    'Golden Belle',
    'Lu Burger',
    'Rumo ao Lucro',
    'Rumo à Máxima Potência',
    'AstraNumérica',
    'Claude Code'
  )
)
UPDATE financial_entries fe
SET financial_contract_id = contract.id
FROM all_contracts contract
WHERE fe.financial_contract_id IS NULL
  AND fe.user_id = contract.user_id
  AND fe.project_id IS NOT DISTINCT FROM contract.project_id
  AND fe.type = contract.type
  AND fe.title = contract.name;
