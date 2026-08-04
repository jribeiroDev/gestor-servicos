"use server";

import { revalidatePath } from "next/cache";
import {
  apagarBloqueio,
  apagarHorario,
  apagarHorariosDia,
  atualizarEstadoReserva,
  createMembroEquipa,
  criarBloqueio,
  criarHorario,
  criarReserva,
  createServico,
  createServiceRoleClient,
  deleteMembroEquipa,
  deleteServico,
  getServico,
  listEquipaAtiva,
  listReservasAtivasPorData,
  updateConfigNotificacao,
  updateServico,
  type ConfiguracaoNotificacao,
  type ReservaEstado,
  type ServicoInsert,
  type ServicoUpdate,
} from "@gestor/database";
import { addMinutes } from "@gestor/utils";
import { requireUser } from "../lib/auth";
import {
  fetchDashboard,
  fetchReservasIntervalo,
  getNomesEquipa,
  mapReservaAgenda,
  type DashboardData,
  type ReservaAgendaView,
} from "../lib/admin-data";
import { enviarPush, notificarReservaPorToken } from "../lib/push";

export async function getDashboardAction(dia: string): Promise<DashboardData> {
  await requireUser();
  return fetchDashboard(dia);
}

export async function getReservasIntervaloAction(from: string, to: string): Promise<ReservaAgendaView[]> {
  await requireUser();
  const [reservas, nomes] = await Promise.all([fetchReservasIntervalo(from, to), getNomesEquipa()]);
  return reservas.map((r) => mapReservaAgenda(r, nomes));
}

export type ActionResult = { ok: true } | { ok: false; erro: string };

/* --------------------------------------------------------------- Serviços */

export async function criarServicoAction(input: {
  nome: string;
  descricao: string;
  duracaoMinutos: number;
  preco: number | null;
  ativo: boolean;
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

/* ----------------------------------------------------------------- Equipa */

export async function criarMembroEquipaAction(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const nome = String(formData.get("nome") ?? "").trim();
  if (nome.length < 2) {
    return { ok: false, erro: "Indique o nome do membro." };
  }
  const foto = formData.get("foto");
  const client = createServiceRoleClient();
  let fotoUrl: string | null = null;
  try {
    if (foto instanceof File && foto.size > 0) {
      if (!foto.type.startsWith("image/")) {
        return { ok: false, erro: "A foto tem de ser uma imagem." };
      }
      if (foto.size > 5 * 1024 * 1024) {
        return { ok: false, erro: "A foto não pode exceder 5 MB." };
      }
      const ext = foto.name.includes(".") ? foto.name.split(".").pop() : "jpg";
      const caminho = `${crypto.randomUUID()}.${ext}`;
      const { error: erroUpload } = await client.storage
        .from("equipa")
        .upload(caminho, foto, { contentType: foto.type, upsert: false });
      if (erroUpload) {
        return { ok: false, erro: `Falha no upload da foto: ${erroUpload.message}` };
      }
      fotoUrl = client.storage.from("equipa").getPublicUrl(caminho).data.publicUrl;
    }
    await createMembroEquipa(client, { nome, foto_url: fotoUrl });
    revalidatePath("/equipa");
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: (erro as Error).message || "Não foi possível adicionar o membro." };
  }
}

export async function apagarMembroEquipaAction(id: string): Promise<ActionResult> {
  await requireUser();
  try {
    await deleteMembroEquipa(createServiceRoleClient(), id);
    revalidatePath("/equipa");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível remover o membro." };
  }
}

/* --------------------------------------------------------------- Reservas */

const ESTADO_MENSAGEM: Partial<Record<ReservaEstado, { title: string; body: string }>> = {
  confirmada: { title: "Reserva confirmada", body: "A sua reserva foi confirmada." },
  cancelada: { title: "Reserva cancelada", body: "A sua reserva foi cancelada." },
  concluida: { title: "Reserva concluída", body: "Obrigado pela sua visita!" },
  no_show: { title: "Falta registada", body: "A sua reserva foi marcada como não comparência." },
};

export type CriarMarcacaoInput = {
  servicoId: string;
  dia: string;
  hora: string;
  nome: string;
  telefone: string;
  profissionalId?: string | null;
};

/** Dois intervalos [ini, fim) sobrepõem-se? (horas "HH:MM" comparam-se bem lexicograficamente). */
function seSobrepoem(aIni: string, aFim: string, bIni: string, bFim: string): boolean {
  return aIni < bFim && bIni < aFim;
}

/**
 * Cria uma marcação a partir do painel (agenda). Ao contrário do cliente, o
 * admin escolhe a hora livremente (encaixes, walk-ins), mas continua a haver
 * guarda contra sobreposições: um profissional não pode ter duas marcações à
 * mesma hora; em "sem preferência" é atribuído um profissional livre. A reserva
 * fica logo "confirmada" (é o negócio a agendá-la) para aparecer na agenda.
 */
export async function criarMarcacaoAdminAction(input: CriarMarcacaoInput): Promise<ActionResult> {
  await requireUser();
  const nome = input.nome?.trim() ?? "";
  const telefone = input.telefone?.trim() ?? "";
  const inicio = input.hora?.slice(0, 5) ?? "";

  if (!input.servicoId || !input.dia || !inicio) {
    return { ok: false, erro: "Escolha o serviço, o dia e a hora." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dia) || !/^\d{2}:\d{2}$/.test(inicio)) {
    return { ok: false, erro: "Data ou hora inválida." };
  }
  if (nome.length < 2) {
    return { ok: false, erro: "Indique o nome do cliente." };
  }

  try {
    const client = createServiceRoleClient();
    const [servico, reservasDia, equipa] = await Promise.all([
      getServico(client, input.servicoId),
      listReservasAtivasPorData(client, input.dia),
      listEquipaAtiva(client).catch(() => []),
    ]);

    const fim = addMinutes(inicio, servico.duracao_minutos);
    const colididas = reservasDia.filter((r) =>
      seSobrepoem(inicio, fim, r.hora_inicio.slice(0, 5), r.hora_fim.slice(0, 5)),
    );

    let profissionalId: string | null = input.profissionalId ?? null;
    if (profissionalId) {
      // Profissional específico: não pode ter marcação sobreposta.
      if (colididas.some((r) => (r.profissional_id ?? null) === profissionalId)) {
        return { ok: false, erro: "Esse profissional já tem uma marcação a essa hora." };
      }
    } else if (equipa.length > 0) {
      // Sem preferência: atribui um profissional livre nessa hora.
      const ocupados = new Set(colididas.map((r) => r.profissional_id).filter(Boolean));
      const livre = equipa.find((m) => !ocupados.has(m.id));
      if (!livre) {
        return { ok: false, erro: "Não há profissionais livres a essa hora. Escolha outra." };
      }
      profissionalId = livre.id;
    } else if (colididas.length > 0) {
      // Sem equipa (cadeira única): qualquer sobreposição é conflito.
      return { ok: false, erro: "Já existe uma marcação a essa hora." };
    }

    await criarReserva(client, {
      servicoId: input.servicoId,
      data: input.dia,
      horaInicio: inicio,
      nomeCliente: nome,
      telefoneCliente: telefone,
      profissionalId,
      estado: "confirmada",
    });
    revalidatePath("/");
    revalidatePath("/agenda");
    return { ok: true };
  } catch (erro) {
    console.error("[agenda] criarMarcacaoAdmin falhou:", (erro as Error).message);
    return { ok: false, erro: "Não foi possível criar a marcação." };
  }
}

export async function definirEstadoReservaAction(
  id: string,
  estado: ReservaEstado,
): Promise<ActionResult> {
  await requireUser();
  try {
    const reserva = await atualizarEstadoReserva(createServiceRoleClient(), id, estado);
    revalidatePath("/");
    revalidatePath("/agenda");

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

export async function criarHorariosAction(
  janelas: { diaSemana: number; horaInicio: string; horaFim: string; profissionalId?: string | null }[],
): Promise<ActionResult> {
  await requireUser();
  if (janelas.length === 0) {
    return { ok: false, erro: "Sem horários para adicionar." };
  }
  for (const janela of janelas) {
    if (janela.diaSemana < 0 || janela.diaSemana > 6) {
      return { ok: false, erro: "Dia da semana inválido." };
    }
    if (!janela.horaInicio || !janela.horaFim || janela.horaInicio >= janela.horaFim) {
      return { ok: false, erro: "A hora de início tem de ser anterior à de fim." };
    }
  }
  // Janelas ordenadas não se podem sobrepor (ex.: manhã tem de acabar antes da tarde).
  const ordenadas = [...janelas].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].horaInicio < ordenadas[i - 1].horaFim) {
      return { ok: false, erro: "As janelas (manhã/tarde) não se podem sobrepor." };
    }
  }
  try {
    const client = createServiceRoleClient();
    for (const janela of janelas) {
      await criarHorario(client, {
        dia_semana: janela.diaSemana,
        hora_inicio: janela.horaInicio,
        hora_fim: janela.horaFim,
        profissional_id: janela.profissionalId ?? null,
      });
    }
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

/**
 * Guarda (cria ou substitui) as janelas de um dia/profissional. Quando `original`
 * é indicado, apaga primeiro esse grupo — permite editar dia/profissional/horas.
 */
export async function guardarHorariosDiaAction(input: {
  original: { diaSemana: number; profissionalId: string | null } | null;
  diaSemana: number;
  profissionalId: string | null;
  janelas: { horaInicio: string; horaFim: string }[];
}): Promise<ActionResult> {
  await requireUser();
  if (input.diaSemana < 0 || input.diaSemana > 6) {
    return { ok: false, erro: "Dia da semana inválido." };
  }
  if (input.janelas.length === 0) {
    return { ok: false, erro: "Adicione pelo menos uma janela de horário." };
  }
  for (const janela of input.janelas) {
    if (!janela.horaInicio || !janela.horaFim || janela.horaInicio >= janela.horaFim) {
      return { ok: false, erro: "A hora de início tem de ser anterior à de fim." };
    }
  }
  const ordenadas = [...input.janelas].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].horaInicio < ordenadas[i - 1].horaFim) {
      return { ok: false, erro: "As janelas não se podem sobrepor." };
    }
  }
  const prof = input.profissionalId || null;
  try {
    const client = createServiceRoleClient();
    if (input.original) {
      await apagarHorariosDia(client, input.original.diaSemana, input.original.profissionalId);
    }
    // Se mudou de dia/profissional, evita duplicar janelas já existentes no destino.
    const mudouAlvo =
      input.original !== null &&
      (input.original.diaSemana !== input.diaSemana || input.original.profissionalId !== prof);
    if (mudouAlvo) {
      await apagarHorariosDia(client, input.diaSemana, prof);
    }
    for (const janela of ordenadas) {
      await criarHorario(client, {
        dia_semana: input.diaSemana,
        hora_inicio: janela.horaInicio,
        hora_fim: janela.horaFim,
        profissional_id: prof,
      });
    }
    revalidatePath("/horarios");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível guardar o horário." };
  }
}

/** Apaga todas as janelas de um dia/profissional (remover um grupo inteiro). */
export async function apagarHorariosDiaAction(
  diaSemana: number,
  profissionalId: string | null,
): Promise<ActionResult> {
  await requireUser();
  try {
    await apagarHorariosDia(createServiceRoleClient(), diaSemana, profissionalId || null);
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
  profissionalId?: string | null;
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
      profissional_id: input.profissionalId ?? null,
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

export type GuardarSubscricaoResult = { ok: boolean; erro?: string };

/** Regista este browser do NEGÓCIO para receber avisos (tipo='admin'). */
export async function guardarSubscricaoAdminAction(subscription: {
  endpoint: string;
  keys: Record<string, unknown>;
}): Promise<GuardarSubscricaoResult> {
  await requireUser();
  try {
    if (!subscription.endpoint) {
      return { ok: false, erro: "Subscrição sem endpoint." };
    }
    const client = createServiceRoleClient();
    // Dedupe por endpoint.
    await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    const { error } = await client.from("push_subscriptions").insert({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      token_acesso: null,
      tipo: "admin",
    });
    if (error) {
      console.error("[push] guardar subscrição admin falhou:", error.message);
      return { ok: false, erro: error.message };
    }
    // Confirmação imediata — prova que a entrega funciona neste dispositivo.
    await enviarPush(subscription, {
      title: "Avisos do negócio ativados",
      body: "Vai receber aqui as reservas novas e as alterações dos clientes.",
      url: "/",
    });
    return { ok: true };
  } catch (erro) {
    console.error("[push] guardarSubscricaoAdminAction exceção:", (erro as Error).message);
    return { ok: false, erro: (erro as Error).message };
  }
}

export async function removerSubscricaoAdminAction(endpoint: string): Promise<GuardarSubscricaoResult> {
  await requireUser();
  try {
    if (!endpoint) {
      return { ok: false, erro: "Endpoint em falta." };
    }
    await createServiceRoleClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: (erro as Error).message };
  }
}

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
