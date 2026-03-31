# WorkOS 26

Workspace pessoal em Next.js com agenda, kanban, second brain, tracker, skills, vault e relatorios.

## O que este projeto e
Este app e um sistema operacional pessoal/profissional mais completo, com rotas autenticadas para agenda, kanban, reports, second-brain, settings, skills, tracker e vault. A presenca de `design-system` e testes unitarios/e2e mostra uma base mais madura e estruturada.

## Modulos principais
- `app/(auth)/auth`: autenticacao
- `app/(dashboard)`: area principal protegida
- `agenda`, `kanban`, `reports`, `tracker`: execucao e acompanhamento
- `second-brain` e `vault`: memoria e conhecimento
- `skills`: organizacao de capacidades e recursos
- `design-system`: vitrine interna de componentes

## Stack
- Next.js
- React
- TypeScript
- Tailwind CSS
- Radix UI
- DnD Kit
- Vitest
- Playwright

## Como rodar
```bash
npm install
npm run db:check
npm run dev
```

## Banco de dados local
- O desenvolvimento local deve usar o mesmo usuario, database e senha definidos no stack Docker/Portainer.
- Configure `DATABASE_URL` em `.env` com a mesma senha usada em `POSTGRES_PASSWORD` no stack.
- Use `npm run db:check` antes de subir o app quando houver duvida sobre host, porta ou credenciais.

## Comandos uteis
```bash
npm run build
npm run start
npm run lint
npm run test
npm run test:e2e
npm run db:check
```

## Estrutura
- `app`: rotas do produto e area protegida
- `components`: interface reutilizavel
- `lib`: utilitarios e integracoes
- `tests`: cobertura de comportamento quando aplicavel

## Objetivo
Ser um painel pessoal de alto contexto para planejamento, execucao, memoria e operacao diaria.
