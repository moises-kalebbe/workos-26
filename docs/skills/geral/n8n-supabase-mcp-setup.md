# n8n + Supabase MCP Setup

Use esta skill para configurar e validar os dois MCP servers.

## Objetivo

- Configurar servidores MCP no cliente
- Validar conectividade basica
- Evitar credenciais hardcoded em arquivos versionados

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
- Supabase: `list_projects` ou `list_tables`
