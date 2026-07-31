-- Migração: distinguir subscrições de push do NEGÓCIO (admin) das do cliente.
-- Executar no SQL Editor do Supabase. Idempotente.

-- 'cliente' = browser de quem faz a marcação (recebe mudanças de estado da sua reserva).
-- 'admin'   = browser do negócio (recebe reservas novas e alterações feitas pelo cliente).
alter table public.push_subscriptions
  add column if not exists tipo text not null default 'cliente';

create index if not exists push_subscriptions_tipo_idx
  on public.push_subscriptions (tipo);
