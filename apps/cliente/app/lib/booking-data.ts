import {
  createServiceRoleClient,
  getServico,
  listBloqueios,
  listEquipaAtiva,
  listHorarios,
  listReservasAtivasPorData,
  listReservasIntervalo,
  listServicosAtivos,
  toOpeningWindows,
  type HorarioFuncionamento,
  type Servico,
} from "@gestor/database";
import {
  dateKey,
  generateSlots,
  type CalendarBlock,
  type OpeningWindow,
  type ReservationRange,
  type Slot,
} from "@gestor/utils";

/** Constrói uma Date local (sem deslize de fuso) a partir de "YYYY-MM-DD". */
function parseDia(dia: string): Date {
  const [ano, mes, d07] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, d07 ?? 1);
}

export async function getServicosAtivos(): Promise<Servico[]> {
  return listServicosAtivos(createServiceRoleClient());
}

export type MembroEquipaView = { id: string; nome: string; fotoUrl: string | null };

export async function getEquipaAtiva(): Promise<MembroEquipaView[]> {
  const membros = await listEquipaAtiva(createServiceRoleClient());
  return membros.map((m) => ({ id: m.id, nome: m.nome, fotoUrl: m.foto_url }));
}

/* ------------------------------------------------------ Núcleo de slots */

type ReservaSlot = { profissional_id: string | null; hora_inicio: string; hora_fim: string };

/**
 * Janelas efetivas de um profissional: as específicas dele; se não tiver
 * nenhuma, usa as janelas gerais (profissional_id nulo) do negócio.
 */
function windowsDoProfissional(horarios: HorarioFuncionamento[], profId: string | null): OpeningWindow[] {
  // Normaliza null/undefined (a coluna pode não existir antes da migração 005).
  const especificos = horarios.filter((h) => (h.profissional_id ?? null) === profId);
  const usar = especificos.length > 0 ? especificos : horarios.filter((h) => (h.profissional_id ?? null) === null);
  return toOpeningWindows(usar);
}

function rangesDoProfissional(reservas: ReservaSlot[], dia: string, profId: string | null): ReservationRange[] {
  return reservas
    .filter((r) => (r.profissional_id ?? null) === profId)
    .map((r) => ({ date: dia, startsAt: r.hora_inicio.slice(0, 5), endsAt: r.hora_fim.slice(0, 5) }));
}

/** Bloqueios que afetam este profissional: os gerais (null) + os dele. */
function blocksDoProfissional(blocks: CalendarBlock[], profId: string | null): CalendarBlock[] {
  return blocks.filter((b) => (b.profissionalId ?? null) === null || (b.profissionalId ?? null) === profId);
}

function slotsDeProfissional(
  data: Date,
  duracao: number,
  horarios: HorarioFuncionamento[],
  reservas: ReservaSlot[],
  blocks: CalendarBlock[],
  profId: string | null,
): Slot[] {
  return generateSlots({
    date: data,
    durationMinutes: duracao,
    openingWindows: windowsDoProfissional(horarios, profId),
    reservations: rangesDoProfissional(reservas, dateKey(data), profId),
    blocks: blocksDoProfissional(blocks, profId),
  });
}

/** União de várias listas de slots: uma hora fica livre se ALGUM profissional a tiver livre. */
function unirSlots(listas: Slot[][]): Slot[] {
  const mapa = new Map<string, Slot>();
  for (const lista of listas) {
    for (const slot of lista) {
      const existente = mapa.get(slot.startsAt);
      if (!existente) {
        mapa.set(slot.startsAt, { ...slot });
      } else if (slot.available && !existente.available) {
        mapa.set(slot.startsAt, { ...slot });
      } else if (!existente.available && !slot.available && !existente.blockedReason && slot.blockedReason) {
        existente.blockedReason = slot.blockedReason;
      }
    }
  }
  return [...mapa.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Slots de um dia para um profissional específico, ou (sem `profissionalId`) a
 * UNIÃO das horas livres de toda a equipa ativa. Sem equipa → disponibilidade
 * global (comportamento clássico de cadeira única).
 */
function calcularSlots(params: {
  data: Date;
  duracao: number;
  horarios: HorarioFuncionamento[];
  reservas: ReservaSlot[];
  blocks: CalendarBlock[];
  equipaIds: string[];
  profissionalId?: string | null;
}): Slot[] {
  const { data, duracao, horarios, reservas, blocks, equipaIds, profissionalId } = params;
  if (profissionalId) {
    return slotsDeProfissional(data, duracao, horarios, reservas, blocks, profissionalId);
  }
  if (equipaIds.length === 0) {
    return slotsDeProfissional(data, duracao, horarios, reservas, blocks, null);
  }
  return unirSlots(equipaIds.map((pid) => slotsDeProfissional(data, duracao, horarios, reservas, blocks, pid)));
}

/* ------------------------------------------------------ APIs de dados */

/** Disponibilidade de um serviço num dia (por profissional ou união). */
export async function getSlotsDisponiveis(
  servicoId: string,
  dia: string,
  profissionalId?: string | null,
): Promise<Slot[]> {
  const client = createServiceRoleClient();
  const data = parseDia(dia);

  const [servico, horarios, reservas, bloqueios, equipa] = await Promise.all([
    getServico(client, servicoId),
    listHorarios(client),
    listReservasAtivasPorData(client, dia),
    listBloqueios(client, { from: dia, to: dia }),
    listEquipaAtiva(client),
  ]);

  const blocks: CalendarBlock[] = bloqueios.map((b) => ({
    startsAt: b.data_inicio,
    endsAt: b.data_fim,
    motivo: b.motivo,
    profissionalId: b.profissional_id ?? null,
  }));

  return calcularSlots({
    data,
    duracao: servico.duracao_minutos,
    horarios,
    reservas,
    blocks,
    equipaIds: equipa.map((e) => e.id),
    profissionalId,
  });
}

/** Dias de um mês com pelo menos uma hora livre (para o calendário). Exclui o passado. */
export async function getDiasDisponiveis(
  servicoId: string,
  ano: number,
  mes: number,
  profissionalId?: string | null,
): Promise<string[]> {
  const client = createServiceRoleClient();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  const from = dateKey(primeiro);
  const to = dateKey(ultimo);

  const [servico, horarios, reservasMes, bloqueios, equipa] = await Promise.all([
    getServico(client, servicoId),
    listHorarios(client),
    listReservasIntervalo(client, from, to),
    listBloqueios(client, { from, to }),
    listEquipaAtiva(client),
  ]);

  const ativas = reservasMes.filter((r) => r.estado === "pendente" || r.estado === "confirmada");
  const blocks: CalendarBlock[] = bloqueios.map((b) => ({
    startsAt: b.data_inicio,
    endsAt: b.data_fim,
    motivo: b.motivo,
    profissionalId: b.profissional_id ?? null,
  }));
  const equipaIds = equipa.map((e) => e.id);
  const hoje = dateKey(new Date());

  const dias: string[] = [];
  for (let d = 1; d <= ultimo.getDate(); d++) {
    const data = new Date(ano, mes, d);
    const chave = dateKey(data);
    if (chave < hoje) {
      continue;
    }
    const reservasDia = ativas.filter((r) => r.data === chave);
    const slots = calcularSlots({
      data,
      duracao: servico.duracao_minutos,
      horarios,
      reservas: reservasDia,
      blocks,
      equipaIds,
      profissionalId,
    });
    if (slots.some((s) => s.available)) {
      dias.push(chave);
    }
  }
  return dias;
}

/**
 * Para "sem preferência": escolhe um profissional livre num dado slot.
 * Devolve `profissionalId: null` quando não há equipa (modo global), ou
 * `{ ok: false }` se ninguém estiver livre.
 */
export async function escolherProfissionalLivre(
  servicoId: string,
  dia: string,
  hora: string,
): Promise<{ ok: true; profissionalId: string | null } | { ok: false }> {
  const client = createServiceRoleClient();
  const data = parseDia(dia);
  const alvo = hora.slice(0, 5);

  const [servico, horarios, reservas, bloqueios, equipa] = await Promise.all([
    getServico(client, servicoId),
    listHorarios(client),
    listReservasAtivasPorData(client, dia),
    listBloqueios(client, { from: dia, to: dia }),
    listEquipaAtiva(client),
  ]);
  const blocks: CalendarBlock[] = bloqueios.map((b) => ({
    startsAt: b.data_inicio,
    endsAt: b.data_fim,
    motivo: b.motivo,
    profissionalId: b.profissional_id ?? null,
  }));

  const livre = (profId: string | null) => {
    const slot = slotsDeProfissional(data, servico.duracao_minutos, horarios, reservas, blocks, profId).find(
      (s) => s.startsAt === alvo,
    );
    return Boolean(slot && slot.available);
  };

  if (equipa.length === 0) {
    return livre(null) ? { ok: true, profissionalId: null } : { ok: false };
  }
  for (const membro of equipa) {
    if (livre(membro.id)) {
      return { ok: true, profissionalId: membro.id };
    }
  }
  return { ok: false };
}
