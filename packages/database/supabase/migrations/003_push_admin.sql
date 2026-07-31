-- Migração: garantir a tabela push_subscriptions completa e distinguir
-- subscrições do NEGÓCIO (admin) das do cliente.
-- Executar no SQL Editor do Supabase. Idempotente e auto-reparadora.
--
-- Corrige o erro "Could not find the 'keys' column of 'push_subscriptions'
-- in the schema cache": a tabela em produção estava incompleta.

-- 1. Cria a tabela se não existir (definição completa) --------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete cascade,
  token_acesso uuid,
  tipo text not null default 'cliente', -- 'cliente' | 'admin'
  endpoint text not null,
  keys jsonb not null,
  criado_em timestamptz not null default now()
);

-- 2. Adiciona colunas em falta (repara tabelas antigas/incompletas) -------
--    Nulláveis aqui para nunca falhar mesmo com linhas existentes; a app
--    fornece sempre endpoint+keys.
alter table public.push_subscriptions add column if not exists reserva_id uuid;
alter table public.push_subscriptions add column if not exists token_acesso uuid;
alter table public.push_subscriptions add column if not exists tipo text not null default 'cliente';
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists keys jsonb;
alter table public.push_subscriptions add column if not exists criado_em timestamptz not null default now();

-- 2b. Uma subscrição pode não estar ligada a uma reserva concreta (o negócio
--     subscreve sem reserva; o cliente liga-se por token_acesso, não por id).
--     Remove NOT NULL herdado de versões antigas da tabela.
alter table public.push_subscriptions alter column reserva_id drop not null;
alter table public.push_subscriptions alter column token_acesso drop not null;

-- 2c. Colunas legadas de um esquema antigo (p256dh/auth em vez de keys jsonb).
--     O código atual usa a coluna `keys`; torna as legadas opcionais para não
--     bloquearem o insert. Só age se realmente existirem.
do $$
declare
  col text;
begin
  foreach col in array array['p256dh', 'auth'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'push_subscriptions'
        and column_name = col
    ) then
      execute format('alter table public.push_subscriptions alter column %I drop not null', col);
    end if;
  end loop;
end
$$;

-- 3. Índices --------------------------------------------------------------
create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_tipo_idx
  on public.push_subscriptions (tipo);

-- 4. RLS ligada (o acesso é via service role, que a ignora) ---------------
alter table public.push_subscriptions enable row level security;

-- 5. Força o PostgREST a recarregar o cache de schema ---------------------
notify pgrst, 'reload schema';
