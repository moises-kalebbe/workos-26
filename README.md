# WorkOS (Next.js 14)

Aplicacao de produtividade com App Router, Supabase e design system customizado com Tailwind + shadcn.

## Stack

- Next.js 14 (`app/` router)
- React 18
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (`@supabase/ssr` + `@supabase/supabase-js`)
- Vitest
- Playwright (smoke E2E)

## Setup

1. Instale dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente (`.env`):

```env
NEXT_PUBLIC_SUPABASE_PROJECT_ID=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
```

3. Rode o projeto:

```bash
npm run dev
```

## Scripts

- `npm run dev` - desenvolvimento
- `npm run build` - build de producao
- `npm run start` - servidor de producao
- `npm run lint` - lint
- `npm run test` - testes unitarios (Vitest)
- `npm run test:e2e` - smoke E2E (Playwright)

## Estrutura principal

- `app/` - rotas Next App Router
- `src/pages/` - modulos de tela (cliente)
- `src/components/system/` - componentes de design system
- `src/config/` - configuracoes tipadas para UI e constantes
- `src/lib/supabase/` - cliente browser + server para Supabase SSR
- `docs/migration/` - baseline e matriz de paridade

## E2E

Para smoke autenticado, defina:

```env
E2E_EMAIL=
E2E_PASSWORD=
```

Opcionalmente:

```env
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

