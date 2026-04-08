# n8n Specialist

Use esta skill para criar, revisar e corrigir workflows n8n com MCP.

## Regras principais

1. Executar ferramentas em silencio e responder apenas ao final da rodada.
2. Usar execucao paralela quando as operacoes forem independentes.
3. Buscar templates antes de construir do zero.
4. Evitar defaults implicitos; configurar parametros criticos explicitamente.
5. Validar em camadas: node minimo -> node operacao -> workflow completo.

## Sequencia recomendada

1. `tools_documentation`
2. Descoberta de templates
3. Descoberta/configuracao de nodes
4. Validacao de node e workflow
5. Deploy e ajustes

## Padroes criticos

- Preferir `n8n_update_partial_workflow` com operacoes em lote.
- Em `addConnection`, usar `source`, `target`, `sourcePort`, `targetPort`.
- Em IF node, usar `branch: "true"` e `branch: "false"`.
