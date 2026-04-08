-- Seed category "Geral" and 3 MCP-focused skills for all active users.
-- Idempotent: safe to run multiple times.

WITH active_users AS (
  SELECT id AS user_id FROM profiles
  UNION
  SELECT DISTINCT user_id FROM skill_categories
),
upsert_general_category AS (
  INSERT INTO skill_categories (user_id, name, slug, description)
  SELECT
    au.user_id,
    'Geral',
    'geral',
    'Skills gerais para operacao e automacao.'
  FROM active_users au
  ON CONFLICT (user_id, slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW()
  RETURNING id, user_id
),
general_categories AS (
  SELECT id, user_id FROM upsert_general_category
  UNION
  SELECT sc.id, sc.user_id
  FROM skill_categories sc
  JOIN active_users au ON au.user_id = sc.user_id
  WHERE sc.slug = 'geral'
),
skills_seed AS (
  SELECT
    gc.user_id,
    gc.id AS category_id,
    'n8n Specialist (MCP)'::text AS title,
    'n8n-specialist-mcp'::text AS slug,
    'Especialista em n8n com foco em template-first, validacao e execucao paralela.'::text AS summary,
    $$# n8n Specialist (MCP)

Use quando precisar criar ou ajustar workflows n8n com MCP.

## Regras principais
1. Executar ferramentas em silencio e responder ao final.
2. Priorizar execucao paralela quando possivel.
3. Buscar templates antes de construir do zero.
4. Nao confiar em defaults: configurar parametros explicitamente.
5. Validar em camadas: node minimo -> node operacao -> workflow.

## Sequencia recomendada
1. `tools_documentation`
2. Descoberta de templates
3. Descoberta de nodes
4. Validacoes de node e workflow
5. Deploy e ajustes

## Padroes criticos
- `n8n_update_partial_workflow` com operacoes em lote.
- Em `addConnection`, usar `source`, `target`, `sourcePort`, `targetPort`.
- Em IF node, usar `branch: "true"` e `branch: "false"`.$$::text AS content_md,
    'seed'::text AS source_type
  FROM general_categories gc

  UNION ALL

  SELECT
    gc.user_id,
    gc.id AS category_id,
    'Supabase Specialist (MCP)'::text AS title,
    'supabase-specialist-mcp'::text AS slug,
    'Especialista em Supabase com foco em consultas seguras, migrations e integracao com n8n.'::text AS summary,
    $$# Supabase Specialist (MCP)

Use quando precisar operar banco no Supabase via MCP.

## Regras principais
1. Usar ferramentas MCP do Supabase.
2. Em exploracao, usar `LIMIT 10` por padrao.
3. Ver estrutura com `list_tables` antes de consultar.
4. DDL com `apply_migration`; DML com `execute_sql`.
5. Preferir agregacoes quando apropriado.

## Fluxo recomendado
1. `list_tables({ project_id })`
2. `execute_sql({ project_id, query: "... LIMIT 10" })`
3. `apply_migration({ project_id, name, query })`
4. `get_advisors({ project_id, type: "security" | "performance" })`

## Integracao com n8n
- Criar views para consumo mais simples em workflows.
- Evitar expor PII sem necessidade.$$::text AS content_md,
    'seed'::text AS source_type
  FROM general_categories gc

  UNION ALL

  SELECT
    gc.user_id,
    gc.id AS category_id,
    'Setup MCP n8n + Supabase'::text AS title,
    'setup-mcp-n8n-supabase'::text AS slug,
    'Guia para configurar e validar MCP de n8n e Supabase com credenciais seguras.'::text AS summary,
    $$# Setup MCP n8n + Supabase

Use quando precisar configurar os MCP servers de n8n e Supabase.

## Objetivo
- Configurar MCP no cliente
- Validar conectividade
- Evitar segredos hardcoded em arquivos versionados

## Exemplo (com variaveis de ambiente)
```toml
[mcp_servers.n8n-mcp]
command = "npx"
args = ["-y", "n8n-mcp@2.12.2"]

[mcp_servers.n8n-mcp.env]
MCP_MODE = "stdio"
LOG_LEVEL = "error"
DISABLE_CONSOLE_OUTPUT = "true"
N8N_API_URL = "${N8N_API_URL}"
N8N_API_KEY = "${N8N_API_KEY}"

[mcp_servers.supabase]
command = "npx"
args = ["-y", "@supabase/mcp-server-supabase@0.5.5", "--access-token", "${SUPABASE_ACCESS_TOKEN}"]
```

## Validacao minima
- n8n: `n8n_health_check`, `n8n_list_available_tools`
- Supabase: `list_projects` ou `list_tables`$$::text AS content_md,
    'seed'::text AS source_type
  FROM general_categories gc
)
INSERT INTO skill_documents (
  user_id,
  category_id,
  project_id,
  title,
  slug,
  summary,
  content_md,
  source_type
)
SELECT
  ss.user_id,
  ss.category_id,
  NULL::uuid,
  ss.title,
  ss.slug,
  ss.summary,
  ss.content_md,
  ss.source_type
FROM skills_seed ss
ON CONFLICT (user_id, slug) DO UPDATE
SET
  category_id = EXCLUDED.category_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content_md = EXCLUDED.content_md,
  source_type = EXCLUDED.source_type,
  updated_at = NOW();
