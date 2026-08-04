import { dateKey } from "@gestor/utils";
import {
  fetchEquipa,
  fetchReservasIntervalo,
  fetchServicos,
  getNomesEquipa,
  mapReservaAgenda,
} from "../../../lib/admin-data";
import { calcularIntervalo, type Vista } from "../calendar-range";
import { CalendarioClient } from "../calendario-client";

export const dynamic = "force-dynamic";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  const { d, v } = await searchParams;
  const dia = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateKey(new Date());
  const vista: Vista = v === "semana" || v === "mes" ? v : "dia";

  const { from, to } = calcularIntervalo(dia, vista);
  const [reservas, nomes, servicos, equipa] = await Promise.all([
    fetchReservasIntervalo(from, to),
    getNomesEquipa(),
    fetchServicos().catch(() => []),
    fetchEquipa().catch(() => []),
  ]);

  return (
    <CalendarioClient
      diaInicial={dia}
      vistaInicial={vista}
      reservasIniciais={reservas.map((r) => mapReservaAgenda(r, nomes))}
      servicos={servicos
        .filter((s) => s.ativo)
        .map((s) => ({ id: s.id, nome: s.nome, duracaoMinutos: s.duracao_minutos }))}
      equipa={equipa.map((m) => ({ id: m.id, nome: m.nome }))}
    />
  );
}
