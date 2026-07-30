import { createServiceRoleClient, getReservaByToken } from "@gestor/database";
import Link from "next/link";
import { ReservaClient } from "./reserva-client";

export const dynamic = "force-dynamic";

export default async function ReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  const { token } = await params;
  const { novo } = await searchParams;

  let reserva = null;
  try {
    reserva = await getReservaByToken(createServiceRoleClient(), token);
  } catch {
    reserva = null;
  }

  if (!reserva) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-10">
        <section className="rounded-lg border border-stone-200 bg-white p-6">
          <p className="text-sm font-medium text-red-700">Reserva não encontrada</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-950">Este link não é válido</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            O link pode ter expirado ou estar incorreto.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-stone-950 px-4 text-sm font-medium text-white"
          >
            Fazer nova marcação
          </Link>
        </section>
      </main>
    );
  }

  return (
    <ReservaClient
      novo={novo === "1"}
      reserva={{
        token,
        servicoId: reserva.servico_id,
        servicoNome: reserva.servico?.nome ?? "Serviço",
        data: reserva.data,
        horaInicio: reserva.hora_inicio.slice(0, 5),
        horaFim: reserva.hora_fim.slice(0, 5),
        nomeCliente: reserva.nome_cliente,
        estado: reserva.estado,
        confirmadoPeloCliente: reserva.confirmado_pelo_cliente,
      }}
    />
  );
}
