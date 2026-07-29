# Gestor de Serviços

Monorepo para uma aplicação de agendamentos com duas experiências isoladas:

- `apps/cliente`: PWA pública para clientes criarem e gerirem reservas sem conta.
- `apps/admin`: painel protegido para gerir calendário, serviços e notificações.
- `packages/database`: cliente Supabase, tipos e schema SQL.
- `packages/utils`: regras de negócio partilhadas, incluindo geração de slots.
- `packages/ui`: componentes Tailwind partilhados.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

Ou por app:

```bash
pnpm --filter cliente dev
pnpm --filter admin dev
```

## Variáveis de Ambiente

Copie `.env.example` para `.env.local` em cada app ou configure no provider de deploy:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Base de Dados

O schema inicial está em `packages/database/supabase/schema.sql`.
