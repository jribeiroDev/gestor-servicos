import { Button } from "@gestor/ui";
import { CalendarX, RotateCcw } from "lucide-react";

export default function ReservaPage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-10">
      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-sm font-medium text-teal-700">Reserva</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">Detalhes e gestao da sua reserva</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Link de acesso: <span className="font-mono text-stone-800">{params.token}</span>
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button">
            <RotateCcw size={16} />
            Reagendar
          </Button>
          <Button type="button" className="border border-red-200 bg-white text-red-700 hover:bg-red-50">
            <CalendarX size={16} />
            Cancelar
          </Button>
        </div>
      </section>
    </main>
  );
}
