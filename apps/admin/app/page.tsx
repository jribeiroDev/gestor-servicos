import { Button, Input, Panel } from "@gestor/ui";
import { Bell, CalendarDays, Clock, Lock, Plus, Settings, ToggleLeft, Users } from "lucide-react";

const reservations = [
  { hora: "09:00", nome: "Ana Martins", servico: "Corte", estado: "confirmada" },
  { hora: "10:30", nome: "Miguel Sousa", servico: "Barba", estado: "pendente" },
  { hora: "14:00", nome: "Rita Alves", servico: "Corte + Barba", estado: "confirmada" },
];

const services = [
  { nome: "Corte", duracao: 45, preco: "18 EUR", ativo: true },
  { nome: "Barba", duracao: 30, preco: "12 EUR", ativo: true },
  { nome: "Coloracao", duracao: 90, preco: "45 EUR", ativo: false },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200 bg-white p-5 lg:block">
        <h1 className="text-xl font-semibold text-stone-950">Admin Reservas</h1>
        <nav className="mt-8 grid gap-2 text-sm text-stone-700">
          {[
            ["Calendario", CalendarDays],
            ["Servicos", Settings],
            ["Clientes", Users],
            ["Notificacoes", Bell],
          ].map(([label, Icon]) => (
            <a key={label as string} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-stone-100" href="#">
              <Icon size={17} />
              {label as string}
            </a>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="flex flex-col gap-4 border-b border-stone-200 bg-white px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-teal-700">
              <Lock size={15} />
              Painel protegido
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-stone-950">Agenda de hoje</h2>
          </div>
          <div className="flex gap-2">
            <Input className="w-56" placeholder="Pesquisar reserva" />
            <Button>
              <Plus size={16} />
              Nova
            </Button>
          </div>
        </header>

        <div className="grid gap-6 p-5 xl:grid-cols-[1.25fr_0.75fr]">
          <Panel title="Calendario" aside={<span className="text-sm text-stone-500">Realtime preparado</span>}>
            <div className="grid gap-3">
              {reservations.map((reservation) => (
                <div key={reservation.hora} className="grid grid-cols-[72px_1fr_auto] items-center gap-4 rounded-md border border-stone-200 p-4">
                  <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <Clock size={15} />
                    {reservation.hora}
                  </span>
                  <div>
                    <p className="font-medium text-stone-950">{reservation.nome}</p>
                    <p className="text-sm text-stone-500">{reservation.servico}</p>
                  </div>
                  <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">{reservation.estado}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-6">
            <Panel title="Servicos">
              <div className="grid gap-3">
                {services.map((service) => (
                  <div key={service.nome} className="flex items-center justify-between rounded-md border border-stone-200 p-3">
                    <div>
                      <p className="font-medium text-stone-950">{service.nome}</p>
                      <p className="text-sm text-stone-500">
                        {service.duracao} min · {service.preco}
                      </p>
                    </div>
                    <span className={service.ativo ? "text-sm font-medium text-teal-700" : "text-sm font-medium text-stone-400"}>
                      {service.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Notificacoes">
              <div className="grid gap-3 text-sm">
                {["Web Push", "Email", "WhatsApp", "SMS"].map((channel, index) => (
                  <div key={channel} className="flex items-center justify-between rounded-md border border-stone-200 p-3">
                    <span className="font-medium text-stone-800">{channel}</span>
                    <span className="inline-flex items-center gap-2 text-stone-500">
                      <ToggleLeft size={20} />
                      {index === 0 ? "Ativo" : "Opcional"}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </section>
    </main>
  );
}
