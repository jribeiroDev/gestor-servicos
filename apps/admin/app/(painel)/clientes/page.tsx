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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-medium uppercase tracking-wide text-stone-400">
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Telefone</th>
                    <th className="px-4 py-3 text-right">Reservas</th>
                    <th className="px-4 py-3 text-right">Última visita</th>
                    <th className="px-4 py-3 text-right">Próxima</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.telefone} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-stone-950">{cliente.nome}</td>
                      <td className="px-4 py-3 text-stone-600">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <Phone size={13} />
                          {cliente.telefone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">{cliente.totalReservas}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{formatarData(cliente.ultimaVisita)}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{formatarData(cliente.proximaMarcacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
