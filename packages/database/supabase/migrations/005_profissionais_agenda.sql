-- Agenda por profissional: cada reserva e cada janela de horário podem estar
-- associadas a um membro da equipa. A disponibilidade passa a ser calculada por
-- profissional (dois profissionais podem ter o mesmo serviço à mesma hora).

alter table public.reservas
  add column if not exists profissional_id uuid references public.equipa(id) on delete set null;

alter table public.horarios_funcionamento
  add column if not exists profissional_id uuid references public.equipa(id) on delete cascade;

-- Remover a unicidade antiga (servico_id, data, hora_inicio), que impedia dois
-- profissionais de terem o mesmo serviço à mesma hora. Feito por nome-independente
-- (procura a constraint UNIQUE que cobre exatamente essas 3 colunas) para não
-- tocar noutras (ex.: token_acesso).
-- (Nome por omissão da unique antiga; drop direto caso exista.)
alter table public.reservas drop constraint if exists reservas_servico_id_data_hora_inicio_key;

-- Rede de segurança: apaga qualquer unique que cubra exatamente essas 3 colunas,
-- seja qual for o nome. `attname` é `name`, por isso faz-se cast para `text`.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.reservas'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname::text)
        from unnest(con.conkey) k
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
      ) = array['data', 'hora_inicio', 'servico_id']::text[]
  loop
    execute format('alter table public.reservas drop constraint %I', c.conname);
  end loop;
end $$;

-- Um profissional não pode ter duas reservas no mesmo dia/hora.
-- (Só cobre linhas com profissional; as antigas têm profissional_id nulo.)
create unique index if not exists reservas_prof_slot_uk
  on public.reservas (data, hora_inicio, profissional_id)
  where profissional_id is not null;

-- NOTA: não se cria um índice único global (data, hora_inicio) porque os dados
-- antigos podem ter duas reservas de SERVIÇOS diferentes à mesma hora (o esquema
-- anterior permitia-o). O duplo-agendamento sem profissional continua a ser
-- impedido ao nível da aplicação (verificação de disponibilidade antes de inserir).

create index if not exists horarios_profissional_idx
  on public.horarios_funcionamento (profissional_id);
