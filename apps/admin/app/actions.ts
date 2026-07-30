"use server";

import { revalidatePath } from "next/cache";
import {
  apagarBloqueio,
  apagarHorario,
  atualizarEstadoReserva,
  criarBloqueio,
  criarHorario,
  createServico,
  createServiceRoleClient,
  deleteServico,
  updateConfigNotificacao,
  updateServico,
  type ConfiguracaoNotificacao,
  type ReservaEstado,
  type ServicoInsert,
  type ServicoUpdate,
} from "@gestor/database";
import { requireUser } from "../lib/auth";
import { fetchReservasIntervalo, mapReservaAgenda, type ReservaAgendaView } from "../lib/admin-data";
import { notificarReservaPorToken } from "../lib/push";

export async function getReservasIntervaloAction(from: string, to: string): Promise<ReservaAgendaView[]> {
  await requireUser();
  const reservas = await fetchReservasIntervalo(from, to);
  return reservas.map(mapReservaAgenda);
}

export type ActionResult = { ok: true } | { ok: false; erro: string };

/* --------------------------------------------------------------- Serviços */

export async function criarServicoAction(input: {
  nome: string;
  descricao: string;
  duracaoMinutos: number;
  preco: number | null;
  ativo: boolean;
  ordem: number;
}): Promise<ActionResult> {
  await requireUser();
  const nome = input.nome.trim();
  if (nome.length < 2) {
    return { ok: false, erro: "Indique o nome do serviço." };
  }
  if (!Number.isFinite(input.duracaoMinutos) || input.duracaoMinutos <= 0) {
    return { ok: false, erro: "Duração inválida." };
  }
  const payload: ServicoInsert = {
    nome,
    descricao: input.descricao.trim() || null,
    duracao_minutos: Math.round(input.duracaoMinutos),
    preco: input.preco,
    ativo: input.ativo,
    ordem: Math.round(input.ordem),
  };
  try {
    await createServico(createServiceRoleClient(), payload);
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível criar o serviço." };
  }
}

export async function atualizarServicoAction(
  id: string,
  patch: {
    nome: string;
    descricao: string;
    duracaoMinutos: number;
    preco: number | null;
    ativo: boolean;
    ordem: number;
  },
): Promise<ActionResult> {
  await requireUser();
  const nome = patch.nome.trim();
  if (nome.length < 2) {
    return { ok: false, erro: "Indique o nome do serviço." };
  }
  const payload: ServicoUpdate = {
    nome,
    descricao: patch.descricao.trim() || null,
    duracao_minutos: Math.round(patch.duracaoMinutos),
    preco: patch.preco,
    ativo: patch.ativo,
    ordem: Math.round(patch.ordem),
  };
  try {
    await updateServico(createServiceRoleClient(), id, payload);
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível atualizar o serviço." };
  }
}

export async function alternarServicoAtivoAction(id: string, ativo: boolean): Promise<ActionResult> {
  await requireUser();
  try {
    await updateServico(createServiceRoleClient(), id, { ativo });
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível alterar o estado." };
  }
}

export async function apagarServicoAction(id: string): Promise<ActionResult> {
  await requireUser();
  try {
    await deleteServico(createServiceRoleClient(), id);
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível apagar (pode ter reservas associadas)." };
  }
}

/* --------------------------------------------------------------- Reservas */

const ESTADO_MENSAGEM: Partial<Record<ReservaEstado, { title: string; body: string }>> = {
  confirmada: { title: "Reserva confirmada", body: "A sua reserva foi confirmada." },
  cancelada: { title: "Reserva cancelada", body: "A sua reserva foi cancelada." },
  concluida: { title: "Reserva concluída", body: "Obrigado pela sua visita!" },
};

export async function definirEstadoReservaAction(
  id: string,
  estado: ReservaEstado,
): Promise<ActionResult> {
  await requireUser();
  try {
    const reserva = await atualizarEstadoReserva(createServiceRoleClient(), id, estado);
    revalidatePath("/");

    const mensagem = ESTADO_MENSAGEM[estado];
    if (mensagem) {
      const clienteUrl = process.env.NEXT_PUBLIC_CLIENTE_URL ?? "";
      await notificarReservaPorToken(reserva.token_acesso, {
        ...mensagem,
        url: clienteUrl ? `${clienteUrl}/reserva/${reserva.token_acesso}` : undefined,
      });
    }
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível atualizar a reserva." };
  }
}

/* ----------------------------------------------------- Horários / Bloqueios */

export async function criarHorarioAction(input: {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}): Promise<ActionResult> {
  await requireUser();
  if (input.diaSemana < 0 || input.diaSemana > 6) {
    return { ok: false, erro: "Dia da semana inválido." };
  }
  if (!input.horaInicio || !input.horaFim || input.horaInicio >= input.horaFim) {
    return { ok: false, erro: "A hora de início tem de ser anterior à de fim." };
  }
  try {
    await criarHorario(createServiceRoleClient(), {
      dia_semana: input.diaSemana,
      hora_inicio: input.horaInicio,
      hora_fim: input.horaFim,
    });
    revalidatePath("/horarios");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível adicionar o horário." };
  }
}

export async function apagarHorarioAction(id: string): Promise<ActionResult> {
  await requireUser();
  try {
    await apagarHorario(createServiceRoleClient(), id);
    revalidatePath("/horarios");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível remover o horário." };
  }
}

export async function criarBloqueioAction(input: {
  dataInicio: string;
  dataFim: string;
  motivo: string;
}): Promise<ActionResult> {
  await requireUser();
  if (!input.dataInicio || !input.dataFim || new Date(input.dataInicio) >= new Date(input.dataFim)) {
    return { ok: false, erro: "O início tem de ser anterior ao fim." };
  }
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);
  if (new Date(input.dataInicio) < inicioDeHoje) {
    return { ok: false, erro: "Não é possível criar bloqueios em datas passadas." };
  }
  try {
    await criarBloqueio(createServiceRoleClient(), {
      data_inicio: input.dataInicio,
      data_fim: input.dataFim,
      motivo: input.motivo.trim() || null,
    });
    revalidatePath("/horarios");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível criar o bloqueio." };
  }
}

export async function apagarBloqueioAction(id: string): Promise<ActionResult> {
  await requireUser();
  try {
    await apagarBloqueio(createServiceRoleClient(), id);
    revalidatePath("/horarios");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível remover o bloqueio." };
  }
}

/* ---------------------------------------------------------- Notificações */

export async function guardarConfigNotificacaoAction(
  patch: Partial<Omit<ConfiguracaoNotificacao, "id">>,
): Promise<ActionResult> {
  await requireUser();
  try {
    await updateConfigNotificacao(createServiceRoleClient(), patch);
    revalidatePath("/notificacoes");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível guardar as notificações." };
  }
}
