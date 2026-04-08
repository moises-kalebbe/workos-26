# Setup MCP n8n + Supabase

Use esta skill para configurar e validar os MCP servers de n8n e Supabase no cliente.

## Objetivo

- Configurar os dois servidores MCP
- Validar conectividade basica
- Evitar credenciais hardcoded em arquivos versionados

## Pre-requisitos

- `N8N_API_URL`
- `N8N_API_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `npx` disponivel no ambiente

## Exemplo de configuracao

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

### n8n

1. `n8n_health_check`
2. `n8n_list_available_tools`

### Supabase

1. `list_projects`
2. `list_tables` em um `project_id` valido

## Resultado esperado

- n8n responde health check sem erro
- Ferramentas do n8n aparecem listadas
- Supabase retorna projetos acessiveis
- `list_tables` funciona com um `project_id` valido

## Troubleshooting rapido

- Se n8n falhar: revisar `N8N_API_URL`, `N8N_API_KEY` e permissao da chave
- Se Supabase falhar: revisar `SUPABASE_ACCESS_TOKEN`
- Se `npx` falhar: validar Node.js e acesso ao pacote
- Se uma tool aparece mas falha na execucao: validar credencial e escopo, nao apenas instalacao

## Sequencia recomendada depois do setup

1. Validar n8n
2. Validar Supabase
3. Descobrir tabelas alvo
4. So entao montar workflow integrando os dois lados
