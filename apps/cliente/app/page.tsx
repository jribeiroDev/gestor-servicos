"use client";

import { Button, Input } from "@gestor/ui";
import { dateKey, generateSlots } from "@gestor/utils";
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Scissors } from "lucide-react";
import { useMemo, useState } from "react";

const services = [
  { id: "corte", nome: "Corte", descricao: "Corte personalizado com finalizacao.", duracao: 45, preco: "18 EUR" },
  { id: "barba", nome: "Barba", descricao: "Aparar, contorno e toalha quente.", duracao: 30, preco: "12 EUR" },
  { id: "combo", nome: "Corte + Barba", descricao: "Servico completo numa unica visita.", duracao: 60, preco: "28 EUR" },
];

const openings = [1, 2, 3, 4, 5].map((weekday) => ({ weekday: weekday as 1 | 2 | 3 | 4 | 5, start: "09:00", end: "18:00" }));

export default function BookingPage() {
  const [serviceId, setServiceId] = useState(services[0].id);
  const [date, setDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const selectedService = services.find((service) => service.id === serviceId) ?? services[0];
  const slots = useMemo(
    () =>
      generateSlots({
        date,
        durationMinutes: selectedService.duracao,
        openingWindows: openings,
        reservations: [{ date: dateKey(date), startsAt: "10:30", endsAt: "11:15" }],
      }),
    [date, selectedService],
  );

  const shiftDay = (days: number) => {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    setDate(next);
    setSelectedSlot(null);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 md:px-8">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">Agendamento online</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-stone-950">Escolha o servico</h1>
        </div>
        <button className="inline-flex h-10 items-center gap-2 self-start rounded-md border border-stone-300 px-3 text-sm text-stone-700">
          <Bell size={16} />
          Notificacoes
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => {
              setServiceId(service.id);
              setSelectedSlot(null);
            }}
            className={`rounded-lg border bg-white p-5 text-left transition ${
              service.id === serviceId ? "border-teal-700 ring-2 ring-teal-100" : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-800">
              <Scissors size={18} />
            </span>
            <h2 className="text-lg font-semibold text-stone-950">{service.nome}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-stone-600">{service.descricao}</p>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1 text-stone-600">
                <Clock size={15} />
                {service.duracao} min
              </span>
              <strong className="text-stone-950">{service.preco}</strong>
            </div>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="mb-5 flex items-center justify-between">
            <button aria-label="Dia anterior" onClick={() => shiftDay(-1)} className="rounded-md border border-stone-300 p-2">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm text-stone-500">Data</p>
              <h2 className="text-xl font-semibold capitalize text-stone-950">
                {date.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}
              </h2>
            </div>
            <button aria-label="Dia seguinte" onClick={() => shiftDay(1)} className="rounded-md border border-stone-300 p-2">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {slots.map((slot) => (
              <button
                key={slot.startsAt}
                disabled={!slot.available}
                onClick={() => setSelectedSlot(slot.startsAt)}
                className={`h-11 rounded-md border text-sm font-medium transition disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${
                  selectedSlot === slot.startsAt ? "border-teal-700 bg-teal-700 text-white" : "border-stone-300 bg-white text-stone-800"
                }`}
              >
                {slot.startsAt}
              </button>
            ))}
          </div>
        </div>

        <form className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stone-100">
              <CalendarDays size={18} />
            </span>
            <div>
              <h2 className="font-semibold text-stone-950">Dados da reserva</h2>
              <p className="text-sm text-stone-500">{selectedService.nome} · {selectedSlot ?? "Escolha uma hora"}</p>
            </div>
          </div>
          <label className="mb-4 block text-sm font-medium text-stone-700">
            Nome
            <Input className="mt-2" placeholder="O seu nome" />
          </label>
          <label className="mb-5 block text-sm font-medium text-stone-700">
            Telemovel
            <Input className="mt-2" placeholder="+351 900 000 000" />
          </label>
          <Button type="button" disabled={!selectedSlot} className="w-full">
            <Check size={16} />
            Confirmar reserva
          </Button>
        </form>
      </section>
    </main>
  );
}
