import { BookingClient } from "./booking-client";
import { getServicosAtivos } from "./lib/booking-data";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  let servicos: Awaited<ReturnType<typeof getServicosAtivos>> = [];
  try {
    servicos = await getServicosAtivos();
  } catch {
    servicos = [];
  }

  return <BookingClient servicos={servicos} />;
}
