import { addMinutes, type OpeningWindow, type Weekday } from "@gestor/utils";
import type { TypedSupabaseClient } from "./client";
import type {
  BloqueioCalendario,
  ConfiguracaoNotificacao,
  HorarioFuncionamento,
  MembroEquipa,
  MembroEquipaInsert,
  PushSubscriptionRow,
  Reserva,
  ReservaEstado,
  ReservaInsert,
  Servico,
  ServicoInsert,
  ServicoUpdate,
} from "./types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.data === null) {
    throw new Error("Supabase devolveu dados vazios.");
  }
  return result.data;
}

/* ---------------------------------------------------------------- Serviços */

export async function listServicosAtivos(client: TypedSupabaseClient): Promise<Servico[]> {
  return unwrap(
    await client.from("servicos").select("*").eq("ativo", true).order("nome", { ascending: true }),
  );
}

export async function listServicos(client: TypedSupabaseClient): Promise<Servico[]> {
  return unwrap(await client.from("servicos").select("*").order("nome", { ascending: true }));
}

/* ------------------------------------------------------------ Equipa */

export async function listEquipa(client: TypedSupabaseClient): Promise<MembroEquipa[]> {
  return unwrap(
    await client
      .from("equipa")
      .select("*")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true }),
  );
}

export async function createMembroEquipa(
  client: TypedSupabaseClient,
  input: MembroEquipaInsert,
): Promise<MembroEquipa> {
  return unwrap(await client.from("equipa").insert(input).select().single());
}

export async function listEquipaAtiva(client: TypedSupabaseClient): Promise<MembroEquipa[]> {
  return unwrap(
    await client
      .from("equipa")
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true }),
  );
}

export async function deleteMembroEquipa(client: TypedSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("equipa").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getServico(client: TypedSupabaseClient, id: string): Promise<Servico> {
  return unwrap(await client.from("servicos").select("*").eq("id", id).single());
}

export async function createServico(
  client: TypedSupabaseClient,
  input: ServicoInsert,
): Promise<Servico> {
  return unwrap(await client.from("servicos").insert(input).select().single());
}

export async function updateServico(
  client: TypedSupabaseClient,
  id: string,
  patch: ServicoUpdate,
): Promise<Servico> {
  return unwrap(await client.from("servicos").update(patch).eq("id", id).select().single());
}

export async function deleteServico(client: TypedSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("servicos").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

/* ------------------------------------------------------------ Horários */

export async function listHorarios(
  client: TypedSupabaseClient,
): Promise<HorarioFuncionamento[]> {
  return unwrap(
    await client
      .from("horarios_funcionamento")
      .select("*")
      .order("dia_semana", { ascending: true }),
  );
}

/** Converte horários da BD (HH:MM:SS) para OpeningWindow[] usado por generateSlots. */
export function toOpeningWindows(horarios: HorarioFuncionamento[]): OpeningWindow[] {
  return horarios.map((horario) => ({
    weekday: horario.dia_semana as Weekday,
    start: horario.hora_inicio.slice(0, 5),
    end: horario.hora_fim.slice(0, 5),
  }));
}

export async function criarHorario(
  client: TypedSupabaseClient,
  input: { dia_semana: number; hora_inicio: string; hora_fim: string; profissional_id?: string | null },
): Promise<HorarioFuncionamento> {
  return unwrap(await client.from("horarios_funcionamento").insert(input).select().single());
}

export async function apagarHorario(client: TypedSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("horarios_funcionamento").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

/* ------------------------------------------------------------ Bloqueios */

/** "2026-08-05" → "2026-08-06" (limite superior exclusivo). */
function diaSeguinte(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const seguinte = new Date(Date.UTC(ano, (mes ?? 1) - 1, (d ?? 1) + 1));
  return seguinte.toISOString().slice(0, 10);
}

export async function listBloqueios(
  client: TypedSupabaseClient,
  range?: { from?: string; to?: string },
): Promise<BloqueioCalendario[]> {
  let query = client.from("bloqueios_calendario").select("*");
  if (range?.from) {
    query = query.gte("data_fim", range.from);
  }
  if (range?.to) {
    // Limite exclusivo no dia seguinte: com `lte(to)` um bloqueio que começa
    // às 10:00 do dia `to` seria excluído (10:00 > meia-noite de `to`).
    query = query.lt("data_inicio", diaSeguinte(range.to));
  }
  return unwrap(await query.order("data_inicio", { ascending: true }));
}

export async function criarBloqueio(
  client: TypedSupabaseClient,
  input: { data_inicio: string; data_fim: string; motivo?: string | null },
): Promise<BloqueioCalendario> {
  return unwrap(
    await client
      .from("bloqueios_calendario")
      .insert({ data_inicio: input.data_inicio, data_fim: input.data_fim, motivo: input.motivo ?? null })
      .select()
      .single(),
  );
}

export async function apagarBloqueio(client: TypedSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("bloqueios_calendario").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

/* ------------------------------------------------------------ Reservas */

const ESTADOS_ATIVOS: ReservaEstado[] = ["pendente", "confirmada"];

export type ReservaComServico = Reserva & { servico: Servico | null };

export async function listReservasPorData(
  client: TypedSupabaseClient,
  data: string,
): Promise<ReservaComServico[]> {
  return unwrap(
    await client
      .from("reservas")
      .select("*, servico:servicos(*)")
      .eq("data", data)
      .order("hora_inicio", { ascending: true }),
  ) as ReservaComServico[];
}

export async function listReservasIntervalo(
  client: TypedSupabaseClient,
  from: string,
  to: string,
): Promise<ReservaComServico[]> {
  return unwrap(
    await client
      .from("reservas")
      .select("*, servico:servicos(*)")
      .gte("data", from)
      .lte("data", to)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true }),
  ) as ReservaComServico[];
}

export async function listReservasTodas(
  client: TypedSupabaseClient,
): Promise<ReservaComServico[]> {
  return unwrap(
    await client
      .from("reservas")
      .select("*, servico:servicos(*)")
      .order("data", { ascending: false })
      .order("hora_inicio", { ascending: true }),
  ) as ReservaComServico[];
}

/** Reservas ativas (pendente/confirmada) de um dia — para calcular disponibilidade. */
export async function listReservasAtivasPorData(
  client: TypedSupabaseClient,
  data: string,
): Promise<Reserva[]> {
  return unwrap(
    await client
      .from("reservas")
      .select("*")
      .eq("data", data)
      .in("estado", ESTADOS_ATIVOS)
      .order("hora_inicio", { ascending: true }),
  );
}

export async function getReservaByToken(
  client: TypedSupabaseClient,
  token: string,
): Promise<ReservaComServico | null> {
  const { data, error } = await client
    .from("reservas")
    .select("*, servico:servicos(*)")
    .eq("token_acesso", token)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as ReservaComServico | null) ?? null;
}

export type CriarReservaInput = {
  servicoId: string;
  data: string;
  horaInicio: string;
  nomeCliente: string;
  telefoneCliente: string;
  profissionalId?: string | null;
};

/** Cria uma reserva calculando hora_fim a partir da duração do serviço. */
export async function criarReserva(
  client: TypedSupabaseClient,
  input: CriarReservaInput,
): Promise<Reserva> {
  const servico = await getServico(client, input.servicoId);
  const horaInicio = input.horaInicio.slice(0, 5);
  const payload: ReservaInsert = {
    servico_id: input.servicoId,
    data: input.data,
    hora_inicio: horaInicio,
    hora_fim: addMinutes(horaInicio, servico.duracao_minutos),
    nome_cliente: input.nomeCliente.trim(),
    telefone_cliente: input.telefoneCliente.trim(),
    profissional_id: input.profissionalId ?? null,
  };
  return unwrap(await client.from("reservas").insert(payload).select().single());
}

export async function atualizarEstadoReserva(
  client: TypedSupabaseClient,
  id: string,
  estado: ReservaEstado,
): Promise<Reserva> {
  return unwrap(await client.from("reservas").update({ estado }).eq("id", id).select().single());
}

export async function confirmarReservaPorToken(
  client: TypedSupabaseClient,
  token: string,
): Promise<Reserva> {
  return unwrap(
    await client
      .from("reservas")
      .update({ confirmado_pelo_cliente: true, estado: "confirmada" })
      .eq("token_acesso", token)
      .select()
      .single(),
  );
}

export async function cancelarReservaPorToken(
  client: TypedSupabaseClient,
  token: string,
): Promise<Reserva> {
  return unwrap(
    await client
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("token_acesso", token)
      .select()
      .single(),
  );
}

export async function reagendarReservaPorToken(
  client: TypedSupabaseClient,
  token: string,
  novo: { data: string; horaInicio: string },
): Promise<Reserva> {
  const atual = await getReservaByToken(client, token);
  if (!atual) {
    throw new Error("Reserva não encontrada.");
  }
  const servico = await getServico(client, atual.servico_id);
  const horaInicio = novo.horaInicio.slice(0, 5);
  return unwrap(
    await client
      .from("reservas")
      .update({
        data: novo.data,
        hora_inicio: horaInicio,
        hora_fim: addMinutes(horaInicio, servico.duracao_minutos),
        estado: "pendente",
        confirmado_pelo_cliente: false,
      })
      .eq("token_acesso", token)
      .select()
      .single(),
  );
}

/* ------------------------------------------------ Configuração de notificações */

export async function getConfigNotificacao(
  client: TypedSupabaseClient,
): Promise<ConfiguracaoNotificacao> {
  return unwrap(
    await client.from("configuracoes_notificacao").select("*").eq("id", true).single(),
  );
}

export async function updateConfigNotificacao(
  client: TypedSupabaseClient,
  patch: Partial<Omit<ConfiguracaoNotificacao, "id">>,
): Promise<ConfiguracaoNotificacao> {
  return unwrap(
    await client
      .from("configuracoes_notificacao")
      .update(patch)
      .eq("id", true)
      .select()
      .single(),
  );
}

/* --------------------------------------------------- Subscrições web push */

export async function getPushSubscriptionsByToken(
  client: TypedSupabaseClient,
  token: string,
): Promise<PushSubscriptionRow[]> {
  return unwrap(
    await client.from("push_subscriptions").select("*").eq("token_acesso", token),
  );
}

/** Subscrições do NEGÓCIO (browsers admin que ativaram avisos). */
export async function getPushSubscriptionsAdmin(
  client: TypedSupabaseClient,
): Promise<PushSubscriptionRow[]> {
  return unwrap(
    await client.from("push_subscriptions").select("*").eq("tipo", "admin"),
  );
}

export async function apagarPushSubscription(
  client: TypedSupabaseClient,
  endpoint: string,
): Promise<void> {
  const { error } = await client.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    throw new Error(error.message);
  }
}
