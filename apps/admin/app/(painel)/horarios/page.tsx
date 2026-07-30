import { dateKey } from "@gestor/utils";
import { fetchBloqueios, fetchHorarios } from "../../../lib/admin-data";
import { HorariosClient } from "./horarios-client";

export const dynamic = "force-dynamic";

export default async function HorariosPage() {
  const [horarios, bloqueios] = await Promise.all([
    fetchHorarios(),
    fetchBloqueios(dateKey(new Date())),
  ]);

  return (
    <HorariosClient
      horarios={horarios.map((h) => ({
        id: h.id,
        diaSemana: h.dia_semana,
        horaInicio: h.hora_inicio.slice(0, 5),
        horaFim: h.hora_fim.slice(0, 5),
      }))}
      bloqueios={bloqueios.map((b) => ({
        id: b.id,
        dataInicio: b.data_inicio,
        dataFim: b.data_fim,
        motivo: b.motivo,
      }))}
    />
  );
}
