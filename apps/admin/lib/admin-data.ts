import {
  createServiceRoleClient,
  getConfigNotificacao,
  listBloqueios,
  listHorarios,
  listReservasIntervalo,
  listReservasPorData,
  listReservasTodas,
  listServicos,
  type BloqueioCalendario,
  type ConfiguracaoNotificacao,
  type HorarioFuncionamento,
  type ReservaComServico,
  type ReservaEstado,
  type Servico,
} from "@gestor/database";

export type ReservaAgendaView = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  nomeCliente: string;
  telefoneCliente: string;
  servicoNome: string;
  estado: ReservaEstado;
};

export function mapReservaAgenda(reserva: ReservaComServico): ReservaAgendaView {
  return {
    id: reserva.id,
    data: reserva.data,
    horaInicio: reserva.hora_inicio.slice(0, 5),
    horaFim: reserva.hora_fim.slice(0, 5),
    nomeCliente: reserva.nome_cliente,
    telefoneCliente: reserva.telefone_cliente,
    servicoNome: reserva.servico?.nome ?? "Serviço",
    estado: reserva.estado,
  };
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
