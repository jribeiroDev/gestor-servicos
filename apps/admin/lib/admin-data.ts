import {
  createServiceRoleClient,
  getConfigNotificacao,
  listBloqueios,
  listHorarios,
  listEquipa,
  listReservasIntervalo,
  listReservasPorData,
  listReservasTodas,
  listServicos,
  type BloqueioCalendario,
  type ConfiguracaoNotificacao,
  type HorarioFuncionamento,
  type MembroEquipa,
  type ReservaComServico,
  type ReservaEstado,
  type Servico,
} from "@gestor/database";
import { addDays, dateKey } from "@gestor/utils";

export type ReservaAgendaView = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  nomeCliente: string;
  telefoneCliente: string;
  servicoNome: string;
  profissionalNome: string | null;
  estado: ReservaEstado;
};

export function mapReservaAgenda(
  reserva: ReservaComServico,
  nomesEquipa?: Map<string, string>,
): ReservaAgendaView {
  return {
    id: reserva.id,
    data: reserva.data,
    horaInicio: reserva.hora_inicio.slice(0, 5),
    horaFim: reserva.hora_fim.slice(0, 5),
    nomeCliente: reserva.nome_cliente,
    telefoneCliente: reserva.telefone_cliente,
    servicoNome: reserva.servico?.nome ?? "Serviço",
    profissionalNome: reserva.profissional_id ? (nomesEquipa?.get(reserva.profissional_id) ?? null) : null,
    estado: reserva.estado,
  };
}

/** Mapa id→nome dos membros da equipa (para anexar o profissional às reservas). */
export async function getNomesEquipa(): Promise<Map<string, string>> {
  try {
    const membros = await listEquipa(createServiceRoleClient());
    return new Map(membros.map((m) => [m.id, m.nome]));
  } catch {
    // Equipa pode ainda não existir (migração não aplicada) — degrada sem nomes.
    return new Map();
  }
}

export async function fetchServicos(): Promise<Servico[]> {
  return listServicos(createServiceRoleClient());
}

export async function fetchReservasPorData(data: string): Promise<ReservaComServico[]> {
  return listReservasPorData(createServiceRoleClient(), data);
}

export async function fetchReservasIntervalo(from: string, to: string): Promise<ReservaComServico[]> {
  return listReservasIntervalo(createServiceRoleClient(), from, to);
}

export async function fetchConfigNotificacao(): Promise<ConfiguracaoNotificacao> {
  return getConfigNotificacao(createServiceRoleClient());
}

export async function fetchHorarios(): Promise<HorarioFuncionamento[]> {
  return listHorarios(createServiceRoleClient());
}

export async function fetchBloqueios(desde: string): Promise<BloqueioCalendario[]> {
  return listBloqueios(createServiceRoleClient(), { from: desde });
}

export type DashboardData = {
  dia: string;
  reservasDia: ReservaAgendaView[];
  proximas: ReservaAgendaView[];
  kpis: {
    total: number;
    pendentes: number;
    concluidas: number;
    receita: number;
  };
};

const ESTADOS_ATIVOS: ReservaEstado[] = ["pendente", "confirmada"];

/**
 * Dados do painel para um dia específico. Os 4 KPIs e a lista de reservas são
 * referentes a `dia`; as "próximas marcações" são sempre relativas ao dia de
 * hoje real (agenda futura), independentemente do dia que se está a ver.
 */
export async function fetchDashboard(dia: string): Promise<DashboardData> {
  const client = createServiceRoleClient();
  const hojeReal = dateKey(new Date());
  const to = dateKey(addDays(new Date(), 30));

  const [doDia, futuras, nomes] = await Promise.all([
    listReservasPorData(client, dia),
    listReservasIntervalo(client, hojeReal, to),
    getNomesEquipa(),
  ]);

  const proximas = futuras
    .filter((r) => r.data > hojeReal && ESTADOS_ATIVOS.includes(r.estado))
    .slice(0, 6);

  const concluidas = doDia.filter((r) => r.estado === "concluida");
  const receita = concluidas.reduce((acc, r) => acc + (r.servico?.preco ?? 0), 0);

  return {
    dia,
    reservasDia: doDia.filter((r) => r.estado !== "cancelada").map((r) => mapReservaAgenda(r, nomes)),
    proximas: proximas.map((r) => mapReservaAgenda(r, nomes)),
    kpis: {
      total: doDia.filter((r) => r.estado !== "cancelada").length,
      pendentes: doDia.filter((r) => r.estado === "pendente").length,
      concluidas: concluidas.length,
      receita,
    },
  };
}

export type EquipaView = { id: string; nome: string; fotoUrl: string | null };

export async function fetchEquipa(): Promise<EquipaView[]> {
  const membros = await listEquipa(createServiceRoleClient());
  return membros.map((m) => ({ id: m.id, nome: m.nome, fotoUrl: m.foto_url }));
}

export type ClienteAgregado = {
  nome: string;
  telefone: string;
  totalReservas: number;
  ultimaVisita: string | null;
  proximaMarcacao: string | null;
};

/** Agrega as reservas por telefone para produzir uma lista de clientes. */
export async function fetchClientes(hoje: string): Promise<ClienteAgregado[]> {
  const reservas = await listReservasTodas(createServiceRoleClient());
  const mapa = new Map<string, ClienteAgregado & { _datas: string[]; _futuras: string[] }>();

  for (const reserva of reservas) {
    const chave = reserva.telefone_cliente.trim();
    if (!chave) {
      continue;
    }
    const atual =
      mapa.get(chave) ??
      {
        nome: reserva.nome_cliente,
        telefone: chave,
        totalReservas: 0,
        ultimaVisita: null,
        proximaMarcacao: null,
        _datas: [],
        _futuras: [],
      };
    atual.totalReservas += 1;
    atual.nome = reserva.nome_cliente || atual.nome;
    atual._datas.push(reserva.data);
    if (reserva.data >= hoje && reserva.estado !== "cancelada") {
      atual._futuras.push(reserva.data);
    }
    mapa.set(chave, atual);
  }

  return [...mapa.values()]
    .map((cliente) => {
      const passadas = cliente._datas.filter((data) => data < hoje).sort();
      const futuras = cliente._futuras.sort();
      return {
        nome: cliente.nome,
        telefone: cliente.telefone,
        totalReservas: cliente.totalReservas,
        ultimaVisita: passadas.at(-1) ?? null,
        proximaMarcacao: futuras.at(0) ?? null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}
