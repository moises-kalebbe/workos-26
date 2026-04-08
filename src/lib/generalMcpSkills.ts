import type { SkillDocument } from "@/types";

type SkillSourceType = SkillDocument["source_type"];

export type GeneralSeedSkill = {
  title: string;
  slug: string;
  summary: string;
  contentMd: string;
};

type ExistingGeneralSkill = Pick<
  SkillDocument,
  "slug" | "title" | "summary" | "content_md" | "source_type" | "category_id"
>;

type GeneralSkillUpsertRow = {
  user_id: string;
  category_id: string;
  title: string;
  slug: string;
  summary: string;
  content_md: string;
  source_type: SkillSourceType;
};

export const GENERAL_MCP_SKILLS_SEED: GeneralSeedSkill[] = [
  {
    title: "n8n Specialist (MCP)",
    slug: "n8n-specialist-mcp",
    summary: "Especialista em n8n com foco em template-first, validação em camadas e execução paralela.",
    contentMd: `# n8n Specialist (MCP)

Use esta skill quando precisar criar, revisar, corrigir ou evoluir workflows n8n usando MCP.

## Quando usar

- Criar workflow novo a partir de um requisito de negócio
- Ajustar nodes ou expressões em um fluxo existente
- Validar configuração antes de ativar em producao
- Procurar templates ou padrões antes de implementar do zero

## Regras principais

1. Executar ferramentas em silencio e responder apenas com o resultado final.
2. Priorizar execução paralela quando as consultas forem independentes.
3. Buscar templates antes de construir manualmente.
4. Evitar defaults implicitos; configurar parametros criticos explicitamente.
5. Validar em camadas: node mínimo -> node operacao -> workflow completo.

## Sequência recomendada

1. \`n8n_health_check\`
2. \`n8n_list_available_tools\`
3. \`tools_documentation\` ou \`get_node_documentation\`
4. \`search_nodes\` / \`get_node_for_task\`
5. \`validate_node_minimal\`
6. \`validate_node_operation\`
7. \`validate_workflow\` ou \`n8n_validate_workflow\`

## Fluxo prático

### 1. Descobrir a melhor base

- Procurar template com \`get_templates_for_task\` ou \`search_templates\`
- Se não houver template adequado, escolher nodes com \`search_nodes\`

### 2. Montar com estrutura correta

- Prefira \`n8n_update_partial_workflow\` para mudancas incrementais
- Em \`addConnection\`, informar \`source\`, \`target\`, \`sourcePort\` e \`targetPort\`
- Em IF node, usar branches \`true\` e \`false\` corretamente

### 3. Validar antes de ativar

- Validar nodes isolados
- Validar expressões
- Validar conexões
- Validar o workflow inteiro

## Checklist de entrega

- Trigger definido com clareza
- Credenciais corretas e não hardcoded
- Expressões resolvendo com dados reais
- Tratamento mínimo de erro definido
- Workflow validado sem erros bloqueantes
`,
  },
  {
    title: "Supabase Specialist (MCP)",
    slug: "supabase-specialist-mcp",
    summary: "Especialista em Supabase com foco em exploracao segura, SQL objetivo, migrations e operacao via MCP.",
    contentMd: `# Supabase Specialist (MCP)

Use esta skill quando precisar operar banco Supabase com MCP sem improvisar queries nem mexer em schema de forma arriscada.

## Quando usar

- Descobrir projetos e tabelas disponiveis
- Inspecionar dados antes de alterar qualquer coisa
- Rodar SQL de leitura com limite e critério
- Aplicar migrations DDL de forma controlada
- Checar advisors de seguranca e performance

## Regras principais

1. Explorar estrutura antes de consultar dados.
2. Em leitura, usar \`LIMIT 10\` por padrão se o objetivo não exigir mais.
3. DDL com \`apply_migration\`; DML com \`execute_sql\`.
4. Preferir agregacoes e filtros especificos em vez de \`SELECT *\` amplo.
5. Evitar expor PII sem necessidade.

## Sequência recomendada

1. \`list_projects\`
2. \`list_tables({ project_id })\`
3. \`execute_sql({ project_id, query })\`
4. \`apply_migration({ project_id, name, query })\`
5. \`get_advisors({ project_id, type: "security" })\`
6. \`get_advisors({ project_id, type: "performance" })\`

## Padrão de trabalho

### Exploracao

- Confirmar o \`project_id\`
- Listar tabelas do schema relevante
- Inspecionar poucas linhas antes de concluir qualquer coisa

### Alteracoes

- Escrever migration nomeada e reversivel quando possível
- Não misturar DDL e DML sem necessidade
- Validar impacto em RLS e advisors depois da mudanca

### Integração com n8n

- Preferir views ou SQL simples para consumo em workflow
- Reduzir payload e colunas expostas
- Manter nomes previsiveis para facilitar manutenção

## Checklist de entrega

- Projeto certo confirmado
- Tabelas relevantes identificadas
- Query com filtro e limite adequados
- Migration separada de consulta operacional
- Advisors revisados apos mudancas estruturais
`,
  },
  {
    title: "Setup MCP n8n + Supabase",
    slug: "setup-mcp-n8n-supabase",
    summary: "Guia completo para configurar os dois MCP servers com credenciais seguras e validação mínima objetiva.",
    contentMd: `# Setup MCP n8n + Supabase

Use esta skill para configurar e validar os MCP servers de n8n e Supabase no cliente.

## Objetivo

- Configurar os dois servidores MCP
- Validar conectividade básica
- Evitar credenciais hardcoded em arquivos versionados

## Pre-requisitos

- \`N8N_API_URL\`
- \`N8N_API_KEY\`
- \`SUPABASE_ACCESS_TOKEN\`
- \`npx\` disponível no ambiente

## Exemplo de configuração

\`\`\`toml
[mcp_servers.n8n-mcp]
command = "npx"
args = ["-y", "n8n-mcp@2.12.2"]

[mcp_servers.n8n-mcp.env]
MCP_MODE = "stdio"
LOG_LEVEL = "error"
DISABLE_CONSOLE_OUTPUT = "true"
N8N_API_URL = "\${N8N_API_URL}"
N8N_API_KEY = "\${N8N_API_KEY}"

[mcp_servers.supabase]
command = "npx"
args = ["-y", "@supabase/mcp-server-supabase@0.5.5", "--access-token", "\${SUPABASE_ACCESS_TOKEN}"]
\`\`\`

## Validação mínima

### n8n

1. \`n8n_health_check\`
2. \`n8n_list_available_tools\`

### Supabase

1. \`list_projects\`
2. \`list_tables\` em um projeto valido

## Resultado esperado

- n8n responde health check sem erro
- Ferramentas do n8n aparecem listadas
- Supabase retorna projetos acessiveis
- \`list_tables\` funciona com um \`project_id\` valido

## Troubleshooting rápido

- Se n8n falhar: revisar \`N8N_API_URL\`, \`N8N_API_KEY\` e permissão da chave
- Se Supabase falhar: revisar \`SUPABASE_ACCESS_TOKEN\`
- Se \`npx\` falhar: validar Node.js e acesso ao pacote
- Se uma tool aparece mas falha na execução: validar credencial e escopo, não apenas instalacao

## Sequência recomendada depois do setup

1. Validar n8n
2. Validar Supabase
3. Descobrir tabelas alvo
4. Só entao montar workflow integrando os dois lados
`,
  },
];

export function getGeneralMcpSkillUpserts(
  existingSkills: ExistingGeneralSkill[],
  userId: string,
  categoryId: string,
): GeneralSkillUpsertRow[] {
  const existingBySlug = new Map(existingSkills.map((skill) => [skill.slug, skill]));

  return GENERAL_MCP_SKILLS_SEED.flatMap((seed) => {
    const existing = existingBySlug.get(seed.slug);
    const row: GeneralSkillUpsertRow = {
      user_id: userId,
      category_id: categoryId,
      title: seed.title,
      slug: seed.slug,
      summary: seed.summary,
      content_md: seed.contentMd,
      source_type: "seed",
    };

    if (!existing) {
      return [row];
    }

    if (existing.source_type !== "seed") {
      return [];
    }

    const needsUpdate =
      existing.category_id !== categoryId ||
      existing.title !== seed.title ||
      (existing.summary || "") !== seed.summary ||
      existing.content_md !== seed.contentMd;

    return needsUpdate ? [row] : [];
  });
}
