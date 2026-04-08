# Supabase Specialist

Use esta skill para operar banco Supabase com MCP.

## Regras principais

1. Usar MCP tools do Supabase para operacoes.
2. Em exploracao, usar `LIMIT 10` por padrao.
3. Ver estrutura com `list_tables` antes de consultar dados.
4. DDL com `apply_migration`; DML com `execute_sql`.
5. Preferir agregacoes quando possivel.

## Fluxo recomendado

1. `list_tables({ project_id })`
2. `execute_sql({ project_id, query: "... LIMIT 10" })`
3. `apply_migration({ project_id, name, query })`
4. `get_advisors({ project_id, type: "security" | "performance" })`

## Integracao com n8n

- Criar views para simplificar consumo em workflows.
- Evitar exposicao desnecessaria de PII.
