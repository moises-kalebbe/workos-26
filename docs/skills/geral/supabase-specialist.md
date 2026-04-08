# Supabase Specialist (MCP)

Use esta skill quando precisar operar banco Supabase com MCP sem improvisar queries nem mexer em schema de forma arriscada.

## Quando usar

- Descobrir projetos e tabelas disponiveis
- Inspecionar dados antes de alterar qualquer coisa
- Rodar SQL de leitura com limite e criterio
- Aplicar migrations DDL de forma controlada
- Checar advisors de seguranca e performance

## Regras principais

1. Explorar estrutura antes de consultar dados.
2. Em leitura, usar `LIMIT 10` por padrao se o objetivo nao exigir mais.
3. DDL com `apply_migration`; DML com `execute_sql`.
4. Preferir agregacoes e filtros especificos em vez de `SELECT *` amplo.
5. Evitar expor PII sem necessidade.

## Sequencia recomendada

1. `list_projects`
2. `list_tables({ project_id })`
3. `execute_sql({ project_id, query })`
4. `apply_migration({ project_id, name, query })`
5. `get_advisors({ project_id, type: "security" })`
6. `get_advisors({ project_id, type: "performance" })`

## Padrao de trabalho

### Exploracao

- Confirmar o `project_id`
- Listar tabelas do schema relevante
- Inspecionar poucas linhas antes de concluir qualquer coisa

### Alteracoes

- Escrever migration nomeada e reversivel quando possivel
- Nao misturar DDL e DML sem necessidade
- Validar impacto em RLS e advisors depois da mudanca

### Integracao com n8n

- Preferir views ou SQL simples para consumo em workflow
- Reduzir payload e colunas expostas
- Manter nomes previsiveis para facilitar manutencao

## Checklist de entrega

- Projeto certo confirmado
- Tabelas relevantes identificadas
- Query com filtro e limite adequados
- Migration separada de consulta operacional
- Advisors revisados apos mudancas estruturais
