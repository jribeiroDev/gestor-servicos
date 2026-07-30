-- Migração: bloqueios de calendário com HORA.
--
-- Porquê: na base de dados as colunas data_inicio/data_fim de
-- bloqueios_calendario estavam como `date`, pelo que a hora escolhida no
-- painel era descartada pelo Postgres — um bloqueio "05/08 10:00–12:00"
-- ficava gravado como 05/08 → 05/08 (intervalo de duração zero, que não
-- bloqueava nenhum horário).
--
-- Executar no SQL Editor do Supabase. Idempotente.

do $$
begin
  -- 1. Converter para timestamptz preservando os bloqueios existentes.
  --    Um bloqueio de dia inteiro passa a 00:00 → 23:59:59 desse dia.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bloqueios_calendario'
      and column_name = 'data_inicio'
      and data_type = 'date'
  ) then
    alter table public.bloqueios_calendario
      alter column data_inicio type timestamptz
        using (data_inicio::timestamp at time zone current_setting('TimeZone'));

    alter table public.bloqueios_calendario
      alter column data_fim type timestamptz
        using ((data_fim::timestamp + interval '23 hours 59 minutes 59 seconds')
               at time zone current_setting('TimeZone'));
  end if;

  -- 2. Garantir que o intervalo é válido.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bloqueios_calendario'::regclass
      and conname = 'bloqueios_calendario_intervalo_valido'
  ) then
    alter table public.bloqueios_calendario
      add constraint bloqueios_calendario_intervalo_valido
      check (data_inicio < data_fim);
  end if;
end
$$;
