import { BookingClient } from "./booking-client";
import { getEquipaAtiva, getServicosAtivos, type MembroEquipaView } from "./lib/booking-data";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  let servicos: Awaited<ReturnType<typeof getServicosAtivos>> = [];
  let equipa: MembroEquipaView[] = [];
  try {
    [servicos, equipa] = await Promise.all([getServicosAtivos(), getEquipaAtiva()]);
  } catch {
    servicos = [];
    equipa = [];
  }

  return <BookingClient servicos={servicos} equipa={equipa} />;
}
