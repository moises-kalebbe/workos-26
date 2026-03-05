# Quick Start - Avaliacao 30 Dias (M3)

## Objetivo
Validar impacto da feature `Iniciar agora` na metrica principal:
`sessoes iniciadas por usuario ativo por dia`.

## Janela de avaliacao
1. Baseline: 30 dias anteriores ao deploy do Quick Start.
2. Pos-feature: 30 dias apos deploy.

## Metricas obrigatorias
1. `sessions_started_per_user_per_day`.
2. Total de inicios de foco no periodo.
3. Dias ativos de foco no periodo.
4. Conversao de quick start: `focus_session_started / quick_start_clicked`.

## Fonte de dados
1. Tabela `quick_start_events`.
2. Evento `quick_start_clicked`.
3. Evento `focus_session_started`.

## Consulta de referencia (agregacao diaria)
```sql
select
  date_trunc('day', created_at) as day,
  count(*) filter (where event_name = 'quick_start_clicked') as quick_start_clicks,
  count(*) filter (where event_name = 'focus_session_started') as quick_start_starts
from public.quick_start_events
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;
```

## Snapshot atual
Status: aguardando acumulacao de dados de producao para janela completa de 30 dias.

## Recomendacao inicial (ate completar janela)
1. Revisar score semanalmente usando `src/features/tracker/scoringProfile.ts`.
2. Manter fallback habilitado para evitar dead-end.
3. Reavaliar decisao adaptativa apos 30 dias completos.

