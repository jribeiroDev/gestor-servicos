import { dateKey } from "@gestor/utils";
import { fetchReservasPorData } from "../../lib/admin-data";
import { CalendarioClient } from "./calendario-client";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const dia = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateKey(new Date());
  const reservas = await fetchReservasPorData(dia);

  return (
    <CalendarioClient
      dia={dia}
      reservas={reservas.map((reserva) => ({
        id: reserva.id,
        horaInicio: reserva.hora_inicio.slice(0, 5),
        horaFim: reserva.hora_fim.slice(0, 5),
        nomeCliente: reserva.nome_cliente,
        telefoneCliente: reserva.telefone_cliente,
        servicoNome: reserva.servico?.nome ?? "Serviço",
        estado: reserva.estado,
      }))}
    />
  );
}
