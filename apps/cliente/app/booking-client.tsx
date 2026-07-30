"use client";

import { Button, Input } from "@gestor/ui";
import type { Servico } from "@gestor/database";
import { dateKey, type Slot } from "@gestor/utils";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { criarReservaAction, getSlotsAction } from "./actions";
import { NotificacoesButton } from "./notificacoes-button";

function formatarPreco(preco: number | null): string {
  if (preco === null) {
    return "—";
  }
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(preco);
}

export function BookingClient({ servicos }: { servicos: Servico[] }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(servicos[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedService = servicos.find((servico) => servico.id === serviceId) ?? servicos[0];

  useEffect(() => {
    if (!serviceId) {
      setSlots([]);
      return;
    }
    let cancelado = false;
    setLoadingSlots(true);
    getSlotsAction(serviceId, dateKey(date))
      .then((resultado) => {
        if (!cancelado) {
          setSlots(resultado);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setSlots([]);
        }
      })
      .finally(() => {
        if (!cancelado) {
          setLoadingSlots(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [serviceId, date]);

  const shiftDay = (days: number) => {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    setDate(next);
    setSelectedSlot(null);
  };

  const submeter = () => {
    if (!selectedService || !selectedSlot) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await criarReservaAction({
        servicoId: selectedService.id,
        dia: dateKey(date),
        hora: selectedSlot,
        nome,
        telefone,
      });
      if (resultado.ok) {
        router.push(`/reserva/${resultado.token}?novo=1`);
      } else {
        setErro(resultado.erro);
      }
    });
  };

  if (servicos.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-10 md:px-8">
        <h1 className="text-2xl font-semibold text-stone-950">Agendamento online</h1>
        <p className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
          De momento não há serviços disponíveis para marcação.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 md:px-8">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">Agendamento online</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-stone-950">Escolha o serviço</h1>
        </div>
        <NotificacoesButton />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {servicos.map((service) => (
          <button
            key={service.id}
            onClick={() => {
              setServiceId(service.id);
              setSelectedSlot(null);
            }}
            className={`flex items-center gap-3 rounded-lg border bg-white p-3 text-left transition md:block md:p-5 ${
              service.id === serviceId ? "border-teal-700 ring-2 ring-teal-100" : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-800 md:mb-4 md:h-10 md:w-10">
              <Tag size={16} />
            </span>
            <div className="min-w-0 flex-1 md:block">
              <h2 className="truncate text-base font-semibold text-stone-950 md:text-lg">{service.nome}</h2>
              <p className="hidden text-sm leading-6 text-stone-600 md:mt-2 md:block md:min-h-12">
                {service.descricao ?? ""}
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-sm md:mt-5 md:justify-between">
                <span className="inline-flex items-center gap-1 text-stone-600">
                  <Clock size={14} />
                  {service.duracao_minutos} min
                </span>
                <strong className="text-stone-950">{formatarPreco(service.preco)}</strong>
              </div>
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

          {loadingSlots ? (
            <p className="py-8 text-center text-sm text-stone-500">A carregar horários…</p>
          ) : slots.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">Sem horários disponíveis neste dia.</p>
          ) : (
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
          )}
        </div>

        <form
          className="rounded-lg border border-stone-200 bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            submeter();
          }}
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stone-100">
              <CalendarDays size={18} />
            </span>
            <div>
              <h2 className="font-semibold text-stone-950">Dados da reserva</h2>
              <p className="text-sm text-stone-500">
                {selectedService?.nome} · {selectedSlot ?? "Escolha uma hora"}
              </p>
            </div>
          </div>
          <label className="mb-4 block text-sm font-medium text-stone-700">
            Nome
            <Input className="mt-2" placeholder="O seu nome" value={nome} onChange={(event) => setNome(event.target.value)} />
          </label>
          <label className="mb-5 block text-sm font-medium text-stone-700">
            Telemóvel
            <Input
              className="mt-2"
              placeholder="+351 900 000 000"
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
            />
          </label>
          {erro ? <p className="mb-4 text-sm font-medium text-red-700">{erro}</p> : null}
          <Button type="submit" disabled={!selectedSlot || pending} className="w-full">
            <Check size={16} />
            {pending ? "A confirmar…" : "Confirmar reserva"}
          </Button>
        </form>
      </section>
    </main>
  );
}
