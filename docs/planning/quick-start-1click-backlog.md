# Quick Start 1-Clique - Backlog Executavel

## Contexto
Feature orientada a retencao diaria para freelancer solo, com foco em reduzir a inercia de inicio de sessao.

## Objetivo de Produto
1. Aumentar `sessoes iniciadas por usuario ativo por dia`.
2. Reduzir tempo e friccao para iniciar foco.

## Nao-Objetivo
1. Nao alterar billing/plano nesta iniciativa.

## NFRs Acordados
1. Escala esperada: ate 500 usuarios ativos por mes.
2. Seguranca: padrao SaaS (auth + RLS + logs basicos).
3. Disponibilidade alvo: 99%.
4. Ownership: 1 dev.

## Assumptions
1. Sugestao de tarefa vem de dados atuais de tarefas/projetos/sessoes.
2. Heuristica inicial sem IA e sem modelo adaptativo.
3. Fluxo deve ser idempotente para evitar dupla criacao de sessao.

## Decision Log
1. Decisao: usar abordagem heuristica v1.
Racional: melhor equilibrio entre impacto e esforco no MVP.
2. Decisao: incluir fallback de criacao rapida de tarefa.
Racional: remover dead-end quando nao houver tarefa elegivel.
3. Decisao: telemetria minima orientada a metrica principal.
Racional: validar impacto cedo sem aumentar escopo.

## Contrato Funcional do MVP
1. CTA `Iniciar agora` em Dashboard e Tracker.
2. Sistema sugere tarefa elegivel por score deterministico.
3. Clique inicia sessao de foco vinculada a tarefa.
4. Se nao houver sugestao valida, fluxo abre criacao rapida e inicia sessao.
5. Eventos de analytics sao registrados em todos os passos chave.

## Heuristica v1 (Sugestao)
1. Candidatos: tarefas nao concluidas e nao arquivadas.
2. Score base:
`+40` status `in_progress`.
`+25` vence hoje.
`+15` atividade nas ultimas 24h.
`+10` projeto com maior atividade semanal.
`-20` tarefa ja focada por tempo relevante no dia.
3. Desempate por `updated_at` mais recente.
4. Se score maximo abaixo de limiar, acionar fallback.

## Estrutura Tecnica Sugerida
1. Criar `src/features/tracker/suggestion.ts` para regra de sugestao.
2. Criar `src/features/tracker/quickStart.ts` para orquestracao do fluxo.
3. Criar `src/features/tracker/analytics.ts` para eventos.
4. Integrar UI em:
`app/(dashboard)/page.tsx`
`app/(dashboard)/tracker/page.tsx`
5. Reusar infraestrutura Supabase existente com validacao auth/RLS.

## Backlog por Milestone

## M1 - Base Funcional
1. Issue M1-01: Implementar servico de sugestao heuristica v1.
Definition of Done: funcao retorna top tarefa elegivel com score explicavel.
2. Issue M1-02: Implementar acao idempotente de iniciar sessao.
Definition of Done: duplo clique nao cria sessoes duplicadas.
3. Issue M1-03: Adicionar CTA `Iniciar agora` no Tracker.
Definition of Done: clique inicia sessao e atualiza estado da pagina.
4. Issue M1-04: Instrumentar eventos `quick_start_clicked`, `quick_start_suggestion_accepted`, `focus_session_started`.
Definition of Done: eventos visiveis em log/telemetria com payload minimo padronizado.
5. Issue M1-05: Testes unitarios da heuristica.
Definition of Done: cobertura para ranking, desempate e limiar de fallback.

## M2 - UX e Robustez
1. Issue M2-01: Adicionar CTA `Iniciar agora` no Dashboard.
Definition of Done: mesma semantica funcional do Tracker.
2. Issue M2-02: Implementar fallback `Criar tarefa rapida + iniciar`.
Definition of Done: sem tarefa elegivel ainda permite iniciar foco em menos de 2 passos.
3. Issue M2-03: Tratar erros com retry e feedback visual.
Definition of Done: falhas transientes exibem acao de tentar novamente.
4. Issue M2-04: Garantir consistencia de estado apos inicio de sessao.
Definition of Done: pagina reflete sessao ativa mesmo apos latencia/refresh.
5. Issue M2-05: E2E de fluxo rapido no smoke.
Definition of Done: cenario cobre quick start com sugestao e com fallback.

## M3 - Otimizacao por Dados
1. Issue M3-01: Ajustar pesos da heuristica com base em dados reais.
Definition of Done: nova tabela/arquivo de pesos versionado e changelog de ajustes.
2. Issue M3-02: Criar dashboard operacional da metrica principal.
Definition of Done: visibilidade semanal de `sessoes iniciadas por usuario ativo por dia`.
3. Issue M3-03: Rodar avaliacao de 30 dias (baseline vs pos-feature).
Definition of Done: relatorio com impacto, riscos e recomendacao de proxima iteracao.
4. Issue M3-04: Decisao de evolucao para score adaptativo.
Definition of Done: ADR simples com continuar em heuristica ou migrar para adaptativo.

## Criterios de Aceite Globais
1. P95 do fluxo de quick start abaixo de 800ms em condicoes normais.
2. Sem regressao de auth/RLS no fluxo.
3. Zero duplicidade de sessao por interacao repetida.
4. Telemetria minima funcionando para medir impacto.
5. Smoke E2E verde incluindo caminho feliz e fallback.

## Riscos e Mitigacao
1. Risco: sugestao irrelevante reduzir confianca do usuario.
Mitigacao: fallback rapido e revisao semanal de pesos.
2. Risco: inconsistencias de estado apos inicio de sessao.
Mitigacao: idempotencia, invalidador de cache e refetch curto.
3. Risco: dados insuficientes para avaliar impacto.
Mitigacao: padronizar eventos desde M1.

## Ordem Recomendada de Execucao
1. M1-01 -> M1-02 -> M1-03 -> M1-04 -> M1-05
2. M2-01 -> M2-02 -> M2-03 -> M2-04 -> M2-05
3. M3-01 -> M3-02 -> M3-03 -> M3-04
