"use server";

import { revalidatePath } from "next/cache";
import {
  cancelarReservaPorToken,
  confirmarReservaPorToken,
  createServiceRoleClient,
  criarReserva,
  reagendarReservaPorToken,
} from "@gestor/database";
import type { Slot } from "@gestor/utils";
import { getSlotsDisponiveis } from "./lib/booking-data";
import { enviarPush } from "./lib/push";

export async function getSlotsAction(servicoId: string, dia: string): Promise<Slot[]> {
  if (!servicoId || !dia) {
    return [];
  }
  return getSlotsDisponiveis(servicoId, dia);
}

export type CriarReservaInput = {
  servicoId: string;
  dia: string;
  hora: string;
  nome: string;
  telefone: string;
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

  // Reconfirma no servidor que o slot continua disponível.
  const slots = await getSlotsDisponiveis(input.servicoId, input.dia);
  const slot = slots.find((s) => s.startsAt === input.hora.slice(0, 5));
  if (!slot || !slot.available) {
    return { ok: false, erro: "Esse horário já não está disponível. Escolha outro." };
  }

  try {
    const reserva = await criarReserva(createServiceRoleClient(), {
      servicoId: input.servicoId,
      data: input.dia,
      horaInicio: input.hora,
      nomeCliente: nome,
      telefoneCliente: telefone,
    });
    return { ok: true, token: reserva.token_acesso };
  } catch {
    return { ok: false, erro: "Não foi possível criar a reserva. Tente novamente." };
  }
}

export type AcaoReservaResult = { ok: true } | { ok: false; erro: string };

export async function confirmarReservaAction(token: string): Promise<AcaoReservaResult> {
  try {
    await confirmarReservaPorToken(createServiceRoleClient(), token);
    revalidatePath(`/reserva/${token}`);
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível confirmar a reserva." };
  }
}

export async function cancelarReservaAction(token: string): Promise<AcaoReservaResult> {
  try {
    await cancelarReservaPorToken(createServiceRoleClient(), token);
    revalidatePath(`/reserva/${token}`);
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
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível reagendar. O horário pode já estar ocupado." };
  }
}

export type GuardarSubscricaoResult = { ok: boolean };

export async function guardarSubscricaoAction(
  subscription: { endpoint: string; keys: Record<string, unknown> },
  token?: string,
): Promise<GuardarSubscricaoResult> {
  try {
    if (!subscription.endpoint) {
      return { ok: false };
    }
    const client = createServiceRoleClient();
    // Evita duplicados: remove qualquer subscrição com o mesmo endpoint antes de inserir.
    await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await client.from("push_subscriptions").insert({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      token_acesso: token ?? null,
    });
    // Confirmação imediata — prova que a entrega de push está a funcionar.
    await enviarPush(subscription, {
      title: "Notificações ativadas",
      body: "Vai receber avisos sobre a sua reserva.",
      url: token ? `/reserva/${token}` : "/",
    });
    return { ok: true };
  } catch {
    return { ok: false };
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
