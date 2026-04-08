# n8n Specialist (MCP)

Use esta skill quando precisar criar, revisar, corrigir ou evoluir workflows n8n usando MCP.

## Quando usar

- Criar workflow novo a partir de um requisito de negocio
- Ajustar nodes ou expressoes em um fluxo existente
- Validar configuracao antes de ativar em producao
- Procurar templates ou padroes antes de implementar do zero

## Regras principais

1. Executar ferramentas em silencio e responder apenas com o resultado final.
2. Priorizar execucao paralela quando as consultas forem independentes.
3. Buscar templates antes de construir manualmente.
4. Evitar defaults implicitos; configurar parametros criticos explicitamente.
5. Validar em camadas: node minimo -> node operacao -> workflow completo.

## Sequencia recomendada

1. `n8n_health_check`
2. `n8n_list_available_tools`
3. `tools_documentation` ou `get_node_documentation`
4. `search_nodes` / `get_node_for_task`
5. `validate_node_minimal`
6. `validate_node_operation`
7. `validate_workflow` ou `n8n_validate_workflow`

## Fluxo pratico

### 1. Descobrir a melhor base

- Procurar template com `get_templates_for_task` ou `search_templates`
- Se nao houver template adequado, escolher nodes com `search_nodes`

### 2. Montar com estrutura correta

- Prefira `n8n_update_partial_workflow` para mudancas incrementais
- Em `addConnection`, informar `source`, `target`, `sourcePort` e `targetPort`
- Em IF node, usar branches `true` e `false` corretamente

### 3. Validar antes de ativar

- Validar nodes isolados
- Validar expressoes
- Validar conexoes
- Validar o workflow inteiro

## Checklist de entrega

- Trigger definido com clareza
- Credenciais corretas e nao hardcoded
- Expressoes resolvendo com dados reais
- Tratamento minimo de erro definido
- Workflow validado sem erros bloqueantes
