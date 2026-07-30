-- Migração: destinos de notificação configuráveis, dedupe de push e realtime.
-- Executar no SQL Editor do Supabase. Idempotente.

-- 1. Destinos configuráveis por canal ------------------------------------
alter table public.configuracoes_notificacao
  add column if not exists email_destino text,
  add column if not exists whatsapp_numero text,
  add column if not exists sms_numero text;

-- 2. Evitar subscrições push duplicadas (permite upsert por endpoint) -----
create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

-- 3. Realtime na agenda: publicar a tabela reservas -----------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservas'
  ) then
    alter publication supabase_realtime add table public.reservas;
  end if;
end
$$;
