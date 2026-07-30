import {
  createServiceRoleClient,
  getServico,
  listBloqueios,
  listHorarios,
  listReservasAtivasPorData,
  listServicosAtivos,
  toOpeningWindows,
  type Servico,
} from "@gestor/database";
import { generateSlots, type Slot } from "@gestor/utils";

/** Constrói uma Date local (sem deslize de fuso) a partir de "YYYY-MM-DD". */
function parseDia(dia: string): Date {
  const [ano, mes, d07] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, d07 ?? 1);
}

export async function getServicosAtivos(): Promise<Servico[]> {
  return listServicosAtivos(createServiceRoleClient());
}

/**
 * Disponibilidade de um serviço num dia. Corre no servidor e devolve apenas
 * os slots com o booleano `available` — nunca dados de outras reservas.
 */
export async function getSlotsDisponiveis(servicoId: string, dia: string): Promise<Slot[]> {
  const client = createServiceRoleClient();
  const data = parseDia(dia);

  const [servico, horarios, reservas, bloqueios] = await Promise.all([
    getServico(client, servicoId),
    listHorarios(client),
    listReservasAtivasPorData(client, dia),
    listBloqueios(client, { from: dia, to: dia }),
  ]);

  return generateSlots({
    date: data,
    durationMinutes: servico.duracao_minutos,
    openingWindows: toOpeningWindows(horarios),
    reservations: reservas.map((reserva) => ({
      date: dia,
      startsAt: reserva.hora_inicio.slice(0, 5),
      endsAt: reserva.hora_fim.slice(0, 5),
    })),
    blocks: bloqueios.map((bloqueio) => ({
      startsAt: bloqueio.data_inicio,
      endsAt: bloqueio.data_fim,
      motivo: bloqueio.motivo,
    })),
  });
}
