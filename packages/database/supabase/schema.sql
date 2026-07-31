create extension if not exists "pgcrypto";

create type reserva_estado as enum ('pendente', 'confirmada', 'cancelada', 'concluida', 'no_show');

create table if not exists public.servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  duracao_minutos integer not null check (duracao_minutos > 0),
  preco numeric(10, 2),
  ativo boolean not null default true,
  profissional_id uuid,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists public.horarios_funcionamento (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  check (hora_inicio < hora_fim)
);

create table if not exists public.bloqueios_calendario (
  id uuid primary key default gen_random_uuid(),
  data_inicio timestamptz not null,
  data_fim timestamptz not null,
  motivo text,
  check (data_inicio < data_fim)
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  token_acesso uuid not null unique default gen_random_uuid(),
  servico_id uuid not null references public.servicos(id),
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  nome_cliente text not null,
  telefone_cliente text not null,
  estado reserva_estado not null default 'pendente',
  confirmado_pelo_cliente boolean not null default false,
  criado_em timestamptz not null default now(),
  check (hora_inicio < hora_fim),
  unique (servico_id, data, hora_inicio)
);

create table if not exists public.configuracoes_notificacao (
  id boolean primary key default true,
  web_push_ativo boolean not null default true,
  email_ativo boolean not null default false,
  whatsapp_ativo boolean not null default false,
  whatsapp_numero_id text,
  whatsapp_numero text,
  email_destino text,
  sms_numero text,
  sms_ativo boolean not null default false,
  atualizado_em timestamptz not null default now(),
  check (id)
);

create or replace function public.set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_config_notificacao_atualizado on public.configuracoes_notificacao;
create trigger trg_config_notificacao_atualizado
  before update on public.configuracoes_notificacao
  for each row execute function public.set_atualizado_em();

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete cascade,
  token_acesso uuid,
  tipo text not null default 'cliente', -- 'cliente' | 'admin'
  endpoint text not null unique,
  keys jsonb not null,
  criado_em timestamptz not null default now()
);

alter table public.servicos enable row level security;
alter table public.horarios_funcionamento enable row level security;
alter table public.bloqueios_calendario enable row level security;
alter table public.reservas enable row level security;
alter table public.configuracoes_notificacao enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Servicos ativos sao publicos" on public.servicos
  for select using (ativo = true or auth.uid() is not null);

create policy "Admin gere servicos" on public.servicos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Admin acesso total reservas" on public.reservas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Cliente cria reserva" on public.reservas
  for insert with check (true);

create policy "Cliente le reserva por token" on public.reservas
  for select using (token_acesso::text = current_setting('request.jwt.claims', true)::jsonb ->> 'token_acesso');

insert into public.configuracoes_notificacao (id)
values (true)
on conflict (id) do nothing;
