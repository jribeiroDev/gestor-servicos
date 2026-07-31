-- Migração: bloqueios de calendário por profissional.
--
-- Cada colaborador pode ter as suas próprias férias/ausências. Um bloqueio com
-- profissional_id nulo continua a valer para TODOS (fecho do negócio); com um
-- profissional_id específico, só afeta a agenda desse colaborador.

alter table public.bloqueios_calendario
  add column if not exists profissional_id uuid references public.equipa(id) on delete cascade;

create index if not exists bloqueios_profissional_idx
  on public.bloqueios_calendario (profissional_id);

-- Recarregar o cache de esquema do PostgREST.
notify pgrst, 'reload schema';
