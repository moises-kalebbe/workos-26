# WorkOS no Portainer

Use [`portainer-stack.yml`](/C:/workos-26/portainer-stack.yml) para criar e editar a stack direto no painel.

## Como criar

1. No Portainer, abra `Stacks`.
2. Clique em `Add stack`.
3. Nome sugerido: `workos`.
4. Cole o conteúdo de [`portainer-stack.yml`](/C:/workos-26/portainer-stack.yml) no editor.
5. Preencha as variáveis de ambiente no painel antes do deploy.
6. Faça o deploy da stack.

## Variáveis mínimas

```env
POSTGRES_PASSWORD=defina-uma-senha-forte
POSTGRES_USER=workos-user
POSTGRES_DB=workos-db

WORKOS_IMAGE=ghcr.io/moises-kalebbe/workos-26:latest
WORKOS_DOMAIN=workos.moiseskalebbe.cloud

CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx


GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Observações

- Essa stack usa imagem pronta e não depende de `docker build` no servidor.
- Os dados do Postgres ficam no volume `workos-postgres-data`.
- O roteamento externo continua via Traefik na rede `MoiKalebbe`.
- Se você editar a stack no painel e fizer `Update the stack`, o Portainer reaplica os serviços sem precisar do script [`scripts/deploy-vps.sh`](/C:/workos-26/scripts/deploy-vps.sh).
