import { BookingClient } from "./booking-client";
import { carregarBookingData } from "./lib/booking-data";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const { servicos, equipa, erro } = await carregarBookingData();
  return <BookingClient servicos={servicos} equipa={equipa} erroInicial={erro} />;
}
