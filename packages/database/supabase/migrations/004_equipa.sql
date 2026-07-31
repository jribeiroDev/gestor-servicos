-- Equipa: membros do negócio (nome + foto). As fotos ficam num bucket público
-- de Storage chamado "equipa"; o upload é feito com a service role (bypass RLS)
-- e a leitura é pública (bucket public=true).

create table if not exists public.equipa (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  foto_url text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.equipa enable row level security;

-- Bucket público para as fotos dos membros.
insert into storage.buckets (id, name, public)
values ('equipa', 'equipa', true)
on conflict (id) do update set public = true;

-- Leitura pública dos objetos do bucket "equipa" (defensivo — buckets públicos
-- já servem os objetos sem sessão, mas deixamos a política explícita).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Leitura publica equipa'
  ) then
    create policy "Leitura publica equipa"
      on storage.objects for select
      using (bucket_id = 'equipa');
  end if;
end $$;
