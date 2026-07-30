import { dateKey } from "@gestor/utils";
import { Phone } from "lucide-react";
import { fetchClientes } from "../../../lib/admin-data";

export const dynamic = "force-dynamic";

function formatarData(dia: string | null): string {
  if (!dia) return "—";
  const [ano, mes, d07] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, d07 ?? 1).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ClientesPage() {
  const clientes = await fetchClientes(dateKey(new Date()));

  return (
    <section className="lg:min-h-screen">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-5">
        <div>
          <h2 className="text-2xl font-semibold text-stone-950">Clientes</h2>
          <p className="mt-1 text-sm text-stone-500">{clientes.length} cliente(s) com reservas</p>
        </div>
      </header>

      <div className="p-5">
        {clientes.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            Ainda não há clientes com reservas.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <div className="hidden grid-cols-[1.5fr_1fr_auto_auto_auto] gap-4 border-b border-stone-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-400 md:grid">
              <span>Cliente</span>
              <span>Telefone</span>
              <span className="text-right">Reservas</span>
              <span className="text-right">Última visita</span>
              <span className="text-right">Próxima</span>
            </div>
            {clientes.map((cliente) => (
              <div
                key={cliente.telefone}
                className="grid gap-2 border-b border-stone-100 px-4 py-3 last:border-0 md:grid-cols-[1.5fr_1fr_auto_auto_auto] md:items-center md:gap-4"
              >
                <span className="font-medium text-stone-950">{cliente.nome}</span>
                <span className="inline-flex items-center gap-1 text-sm text-stone-600">
                  <Phone size={13} />
                  {cliente.telefone}
                </span>
                <span className="text-sm text-stone-700 md:text-right">{cliente.totalReservas}</span>
                <span className="text-sm text-stone-600 md:text-right">{formatarData(cliente.ultimaVisita)}</span>
                <span className="text-sm text-stone-600 md:text-right">{formatarData(cliente.proximaMarcacao)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
