# ADR-0001: Estrategia de score do Quick Start

## Status
Accepted

## Data
2026-03-05

## Contexto
A feature Quick Start precisa maximizar inicio rapido sem aumentar complexidade operacional.
No ciclo atual, o produto prioriza retencao diaria com ownership de 1 dev e escopo enxuto.

## Decisao
Manter estrategia heuristica versionada (score fixo) como padrao no curto prazo.

Implementacao adotada:
1. Pesos e threshold centralizados em `src/features/tracker/scoringProfile.ts`.
2. Changelog de ajustes no proprio profile versionado.
3. Revisao semanal de pesos baseada em eventos de `quick_start_events`.

## Alternativas consideradas
1. Migrar agora para score adaptativo por usuario.
Risco: maior complexidade de manutencao e menor previsibilidade do comportamento.
2. Manter pesos hardcoded sem versionamento.
Risco: historico de tuning fraco e menor auditabilidade de mudancas.

## Consequencias
1. Evolucao de score fica controlada e rastreavel.
2. Time ganha base de dados para decidir migração adaptativa.
3. Decisao de migrar para adaptativo fica condicionada a evidencias apos janela de 30 dias.

## Criterio para revisitar
Revisitar quando uma das condicoes ocorrer:
1. media diaria de inicios < 1.0 por 2 semanas consecutivas.
2. conversao `started / clicked` < 0.6 por 2 semanas.
3. crescimento de usuarios ativos acima de 2k MAU.

