"use server";

import { revalidatePath } from "next/cache";
import {
  cancelarReservaPorToken,
  confirmarReservaPorToken,
  createServiceRoleClient,
  criarReserva,
  getReservaByToken,
  reagendarReservaPorToken,
  type ReservaEstado,
} from "@gestor/database";
import type { Slot } from "@gestor/utils";
import {
  escolherProfissionalLivre,
  getDiasDisponiveis,
  getSlotsDisponiveis,
} from "./lib/booking-data";
import { enviarPush, notificarAdmins } from "./lib/push";

/** Link para o painel admin (calendário), se configurado. */
function urlAdmin(): string | undefined {
  const base = process.env.NEXT_PUBLIC_ADMIN_URL;
  return base ? base.replace(/\/$/, "") : undefined;
}

/** Descrição curta de uma reserva para o corpo do aviso ao negócio. */
function descrever(reserva: {
  nome_cliente: string;
  data: string;
  hora_inicio: string;
  servico?: { nome?: string | null } | null;
}): string {
  const servico = reserva.servico?.nome ? `${reserva.servico.nome} · ` : "";
  return `${servico}${reserva.nome_cliente} — ${reserva.data} às ${reserva.hora_inicio.slice(0, 5)}`;
}

export type ReservaView = {
  token: string;
  servicoId: string;
  servicoNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  nomeCliente: string;
  estado: ReservaEstado;
  confirmadoPeloCliente: boolean;
};

/** Estado atual da reserva, para atualização silenciosa (sem navegar/recarregar a página). */
export async function getReservaViewAction(token: string): Promise<ReservaView | null> {
  const reserva = await getReservaByToken(createServiceRoleClient(), token);
  if (!reserva) {
    return null;
  }
  return {
    token,
    servicoId: reserva.servico_id,
    servicoNome: reserva.servico?.nome ?? "Serviço",
    data: reserva.data,
    horaInicio: reserva.hora_inicio.slice(0, 5),
    horaFim: reserva.hora_fim.slice(0, 5),
    nomeCliente: reserva.nome_cliente,
    estado: reserva.estado,
    confirmadoPeloCliente: reserva.confirmado_pelo_cliente,
  };
}

export async function getSlotsAction(
  servicoId: string,
  dia: string,
  profissionalId?: string | null,
): Promise<Slot[]> {
  if (!servicoId || !dia) {
    return [];
  }
  return getSlotsDisponiveis(servicoId, dia, profissionalId ?? undefined);
}

/** Dias com disponibilidade num mês (para o calendário). `mes` é 0-based. */
export async function getDiasDisponiveisAction(
  servicoId: string,
  ano: number,
  mes: number,
  profissionalId?: string | null,
): Promise<string[]> {
  if (!servicoId) {
    return [];
  }
  return getDiasDisponiveis(servicoId, ano, mes, profissionalId ?? undefined);
}

export type CriarReservaInput = {
  servicoId: string;
  dia: string;
  hora: string;
  nome: string;
  telefone: string;
  profissionalId?: string | null;
};

export type CriarReservaResult =
  | { ok: true; token: string }
  | { ok: false; erro: string };

export async function criarReservaAction(input: CriarReservaInput): Promise<CriarReservaResult> {
  const nome = input.nome?.trim() ?? "";
  const telefone = input.telefone?.trim() ?? "";

  if (!input.servicoId || !input.dia || !input.hora) {
    return { ok: false, erro: "Escolha o serviço, o dia e a hora." };
  }
  if (nome.length < 2) {
    return { ok: false, erro: "Indique o seu nome." };
  }
  if (telefone.length < 6) {
    return { ok: false, erro: "Indique um telemóvel válido." };
  }

  // Reconfirma no servidor e resolve o profissional a atribuir.
  let profissionalId: string | null;
  if (input.profissionalId) {
    const slots = await getSlotsDisponiveis(input.servicoId, input.dia, input.profissionalId);
    const slot = slots.find((s) => s.startsAt === input.hora.slice(0, 5));
    if (!slot || !slot.available) {
      return { ok: false, erro: "Esse horário já não está disponível. Escolha outro." };
    }
    profissionalId = input.profissionalId;
  } else {
    // Sem preferência: atribui a um profissional livre (ou null se não houver equipa).
    const escolha = await escolherProfissionalLivre(input.servicoId, input.dia, input.hora);
    if (!escolha.ok) {
      return { ok: false, erro: "Esse horário já não está disponível. Escolha outro." };
    }
    profissionalId = escolha.profissionalId;
  }

  try {
    const reserva = await criarReserva(createServiceRoleClient(), {
      servicoId: input.servicoId,
      data: input.dia,
      horaInicio: input.hora,
      nomeCliente: nome,
      telefoneCliente: telefone,
      profissionalId,
    });
    // Avisa o negócio de que entrou uma reserva nova.
    await notificarAdmins({
      title: "Nova reserva",
      body: `${nome} — ${input.dia} às ${input.hora.slice(0, 5)}`,
      url: urlAdmin(),
    });
    return { ok: true, token: reserva.token_acesso };
  } catch (erro) {
    console.error("[reserva] criarReserva falhou:", (erro as Error).message);
    return { ok: false, erro: "Não foi possível criar a reserva. Tente novamente." };
  }
}

/** Notifica o negócio de uma alteração feita pelo próprio cliente. */
async function avisarNegocioAlteracao(token: string, acao: string): Promise<void> {
  try {
    const reserva = await getReservaByToken(createServiceRoleClient(), token);
    if (reserva) {
      await notificarAdmins({ title: `Reserva: ${acao}`, body: descrever(reserva), url: urlAdmin() });
    }
  } catch (erro) {
    console.error("[reserva] aviso ao negócio falhou:", (erro as Error).message);
  }
}

export type AcaoReservaResult = { ok: true } | { ok: false; erro: string };

export async function confirmarReservaAction(token: string): Promise<AcaoReservaResult> {
  try {
    await confirmarReservaPorToken(createServiceRoleClient(), token);
    revalidatePath(`/reserva/${token}`);
    await avisarNegocioAlteracao(token, "confirmada pelo cliente");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível confirmar a reserva." };
  }
}

export async function cancelarReservaAction(token: string): Promise<AcaoReservaResult> {
  try {
    await cancelarReservaPorToken(createServiceRoleClient(), token);
    revalidatePath(`/reserva/${token}`);
    await avisarNegocioAlteracao(token, "cancelada pelo cliente");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível cancelar a reserva." };
  }
}

export async function reagendarReservaAction(
  token: string,
  dia: string,
  hora: string,
): Promise<AcaoReservaResult> {
  if (!dia || !hora) {
    return { ok: false, erro: "Escolha o novo dia e hora." };
  }
  try {
    await reagendarReservaPorToken(createServiceRoleClient(), token, { data: dia, horaInicio: hora });
    revalidatePath(`/reserva/${token}`);
    await avisarNegocioAlteracao(token, "reagendada pelo cliente");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível reagendar. O horário pode já estar ocupado." };
  }
}

export type GuardarSubscricaoResult = { ok: boolean; erro?: string };

export async function guardarSubscricaoAction(
  subscription: { endpoint: string; keys: Record<string, unknown> },
  token?: string,
): Promise<GuardarSubscricaoResult> {
  try {
    if (!subscription.endpoint) {
      return { ok: false, erro: "Subscrição sem endpoint." };
    }
    const client = createServiceRoleClient();
    // Evita duplicados: remove qualquer subscrição com o mesmo endpoint antes de inserir.
    await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    const { error } = await client.from("push_subscriptions").insert({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      token_acesso: token ?? null,
      tipo: "cliente",
    });
    if (error) {
      console.error("[push] guardar subscrição cliente falhou:", error.message);
      return { ok: false, erro: error.message };
    }
    // Confirmação imediata — prova que a entrega de push está a funcionar.
    await enviarPush(subscription, {
      title: "Notificações ativadas",
      body: "Vai receber avisos sobre a sua reserva.",
      url: token ? `/reserva/${token}` : "/",
    });
    return { ok: true };
  } catch (erro) {
    console.error("[push] guardarSubscricaoAction exceção:", (erro as Error).message);
    return { ok: false, erro: (erro as Error).message };
  }
}

/**
 * Liga uma subscrição já existente (por endpoint) a ESTA reserva.
 * Chamado ao abrir a página da reserva quando as notificações já estão ativas
 * — garante que os avisos de mudança de estado chegam a este browser, mesmo
 * que a subscrição tenha sido criada antes (ex.: na página principal, sem token).
 */
export async function associarSubscricaoTokenAction(
  endpoint: string,
  token: string,
): Promise<GuardarSubscricaoResult> {
  try {
    if (!endpoint || !token) {
      return { ok: false, erro: "Faltam dados." };
    }
    const { error } = await createServiceRoleClient()
      .from("push_subscriptions")
      .update({ token_acesso: token, tipo: "cliente" })
      .eq("endpoint", endpoint);
    if (error) {
      console.error("[push] associar token falhou:", error.message);
      return { ok: false, erro: error.message };
    }
    return { ok: true };
  } catch (erro) {
    console.error("[push] associarSubscricaoTokenAction exceção:", (erro as Error).message);
    return { ok: false, erro: (erro as Error).message };
  }
}

export async function removerSubscricaoAction(endpoint: string): Promise<GuardarSubscricaoResult> {
  try {
    if (!endpoint) {
      return { ok: false };
    }
    await createServiceRoleClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
