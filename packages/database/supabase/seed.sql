-- Seed de dados de demonstração (genérico / multi-serviço).
-- Idempotente: pode ser executado várias vezes sem duplicar.

-- Serviços genéricos ------------------------------------------------------
insert into public.servicos (nome, descricao, duracao_minutos, preco, ativo, ordem)
select v.nome, v.descricao, v.duracao_minutos, v.preco, v.ativo, v.ordem
from (values
  ('Consulta inicial', 'Primeira avaliação e levantamento de necessidades.', 30, 25.00, true, 1),
  ('Sessão de acompanhamento', 'Sessão de seguimento para clientes existentes.', 45, 35.00, true, 2),
  ('Serviço completo', 'Serviço detalhado numa única visita.', 60, 55.00, true, 3),
  ('Serviço premium', 'Serviço alargado com preparação e finalização.', 90, 85.00, false, 4)
) as v(nome, descricao, duracao_minutos, preco, ativo, ordem)
where not exists (select 1 from public.servicos s where s.nome = v.nome);

-- Horários de funcionamento (segunda a sexta, 09:00–18:00) -----------------
insert into public.horarios_funcionamento (dia_semana, hora_inicio, hora_fim)
select d.dia_semana, time '09:00', time '18:00'
from (values (1), (2), (3), (4), (5)) as d(dia_semana)
where not exists (
  select 1 from public.horarios_funcionamento h where h.dia_semana = d.dia_semana
);

-- Configuração de notificações (linha singleton) ---------------------------
insert into public.configuracoes_notificacao (id)
values (true)
on conflict (id) do nothing;
