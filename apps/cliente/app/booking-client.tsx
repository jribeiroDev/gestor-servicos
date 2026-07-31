"use client";

import { Button, Input, ThemeToggle } from "@gestor/ui";
import type { Servico } from "@gestor/database";
import {
  addDays,
  dateKey,
  generateMonthGrid,
  startOfWeek,
  type Slot,
} from "@gestor/utils";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { criarReservaAction, getSlotsAction } from "./actions";
import { NotificacoesButton } from "./notificacoes-button";

type Vista = "dia" | "semana" | "mes";

const DIAS_CURTO_SEG = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function formatarPreco(preco: number | null): string {
  if (preco === null) {
    return "—";
  }
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(preco);
}

export function BookingClient({ servicos }: { servicos: Servico[] }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(servicos[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date());
  const [vista, setVista] = useState<Vista>("dia");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedService =
    servicos.find((servico) => servico.id === serviceId) ?? servicos[0];

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

  const selecionarDia = (novaData: Date) => {
    setDate(novaData);
    setSelectedSlot(null);
  };

  const shift = (delta: number) => {
    const next = new Date(date);
    if (vista === "dia") {
      next.setDate(date.getDate() + delta);
    } else if (vista === "semana") {
      next.setDate(date.getDate() + delta * 7);
    } else {
      next.setMonth(date.getMonth() + delta, 1);
    }
    selecionarDia(next);
  };

  const titulo = useMemo(() => {
    if (vista === "dia") {
      return date.toLocaleDateString("pt-PT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
    }
    if (vista === "semana") {
      const inicio = startOfWeek(date);
      const fim = addDays(inicio, 6);
      const fmtInicio = inicio.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
      });
      const fmtFim = fim.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return `${fmtInicio} – ${fmtFim}`;
    }
    return date.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  }, [date, vista]);

  const diasSemana = useMemo(() => {
    const inicio = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  }, [date]);

  // Motivos dos bloqueios que afetam o dia, com o intervalo de horas coberto.
  const motivosBloqueio = useMemo(() => {
    const mapa = new Map<string, { inicio: string; fim: string }>();
    for (const slot of slots) {
      if (!slot.blockedReason) {
        continue;
      }
      const atual = mapa.get(slot.blockedReason);
      if (!atual) {
        mapa.set(slot.blockedReason, {
          inicio: slot.startsAt,
          fim: slot.endsAt,
        });
      } else {
        if (slot.startsAt < atual.inicio) atual.inicio = slot.startsAt;
        if (slot.endsAt > atual.fim) atual.fim = slot.endsAt;
      }
    }
    return [...mapa.entries()].map(([motivo, { inicio, fim }]) => ({
      motivo,
      horas: `${inicio}–${fim}`,
    }));
  }, [slots]);

  const grelhaMes = useMemo(() => generateMonthGrid(date), [date]);
  const hojeKey = dateKey(new Date());
  const diaSelecionadoKey = dateKey(date);

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
        <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">
          Agendamento online
        </h1>
        <p className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
          De momento não há serviços disponíveis para marcação.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 md:px-8">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-center md:justify-between dark:border-stone-800">
        <div>
          <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
            Agendamento online
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">
            Escolha o serviço
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificacoesButton />
          <ThemeToggle />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {servicos.map((service) => (
          <button
            key={service.id}
            onClick={() => {
              setServiceId(service.id);
              setSelectedSlot(null);
            }}
            className={`flex items-center gap-3 rounded-lg border bg-white p-3 text-left transition md:block md:p-5 dark:bg-stone-900 ${
              service.id === serviceId
                ? "border-teal-700 ring-2 ring-teal-100 dark:border-teal-500 dark:ring-teal-900/40"
                : "border-stone-200 hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-600"
            }`}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-800 md:mb-4 md:h-10 md:w-10 dark:bg-teal-950/50 dark:text-teal-300">
              <Tag size={16} />
            </span>
            <div className="min-w-0 flex-1 md:block">
              <h2 className="truncate text-base font-semibold text-stone-950 md:text-lg dark:text-stone-100">
                {service.nome}
              </h2>
              <p className="hidden text-sm leading-6 text-stone-600 md:mt-2 md:block md:min-h-12 dark:text-stone-400">
                {service.descricao ?? ""}
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-sm md:mt-5 md:justify-between">
                <span className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-400">
                  <Clock size={14} />
                  {service.duracao_minutos} min
                </span>
                <strong className="text-stone-950 dark:text-stone-100">
                  {formatarPreco(service.preco)}
                </strong>
              </div>
            </div>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-4 flex justify-end">
            <div className="inline-flex rounded-md border border-stone-300 p-0.5 text-xs dark:border-stone-700">
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVista(v)}
                  className={`rounded px-2.5 py-1 capitalize transition ${
                    vista === v
                      ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950"
                      : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                  }`}
                >
                  {v === "mes" ? "Mês" : v}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <button
              aria-label="Anterior"
              onClick={() => shift(-1)}
              className="rounded-md border border-stone-300 p-2 dark:border-stone-700"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
                {vista === "dia"
                  ? "Data"
                  : vista === "semana"
                    ? "Semana"
                    : "Mês"}
                {vista === "dia" && loadingSlots && slots.length > 0 ? (
                  <RefreshCw
                    size={12}
                    className="animate-spin text-stone-400 dark:text-stone-500"
                  />
                ) : null}
              </p>
              <h2 className="text-xl font-semibold capitalize text-stone-950 dark:text-stone-100">
                {titulo}
              </h2>
            </div>
            <button
              aria-label="Seguinte"
              onClick={() => shift(1)}
              className="rounded-md border border-stone-300 p-2 dark:border-stone-700"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {vista === "semana" ? (
            <div className="mb-5 grid grid-cols-7 gap-1.5">
              {diasSemana.map((d) => {
                const key = dateKey(d);
                const selecionado = key === diaSelecionadoKey;
                const ehHoje = key === hojeKey;
                return (
                  <button
                    key={key}
                    onClick={() => selecionarDia(d)}
                    className={`flex flex-col items-center gap-0.5 rounded-md border py-2 text-xs transition ${
                      selecionado
                        ? "border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600"
                        : ehHoje
                          ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900/60 dark:bg-teal-950/50 dark:text-teal-300"
                          : "border-stone-200 text-stone-700 hover:border-stone-300 dark:border-stone-800 dark:text-stone-300 dark:hover:border-stone-600"
                    }`}
                  >
                    <span className="uppercase">
                      {DIAS_CURTO_SEG[(d.getDay() + 6) % 7]}
                    </span>
                    <span className="text-sm font-semibold">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {vista === "mes" ? (
            <div className="mb-5 overflow-hidden rounded-md border border-stone-200 dark:border-stone-800">
              <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-[11px] font-medium uppercase text-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-500">
                {DIAS_CURTO_SEG.map((label) => (
                  <div key={label} className="py-1.5">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grelhaMes.map(({ date: d, inMonth }) => {
                  const key = dateKey(d);
                  const selecionado = key === diaSelecionadoKey;
                  const ehHoje = key === hojeKey;
                  return (
                    <button
                      key={key}
                      onClick={() => selecionarDia(d)}
                      className={`flex h-10 items-center justify-center border-b border-r border-stone-100 text-sm transition hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800 ${
                        inMonth
                          ? "text-stone-800 dark:text-stone-300"
                          : "text-stone-300 dark:text-stone-500"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          selecionado
                            ? "bg-teal-700 text-white dark:bg-teal-600"
                            : ehHoje
                              ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
                              : ""
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {vista !== "dia" ? (
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
              Horários para{" "}
              <span className="capitalize">
                {date.toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </span>
              {loadingSlots && slots.length > 0 ? (
                <RefreshCw
                  size={13}
                  className="animate-spin text-stone-400 dark:text-stone-500"
                />
              ) : null}
            </p>
          ) : null}

          {motivosBloqueio.length > 0 ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/40">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-300">
                <Ban size={14} />
                Períodos indisponíveis neste dia
              </p>
              <ul className="mt-1.5 grid gap-0.5 text-sm text-amber-800 dark:text-amber-300">
                {motivosBloqueio.map(({ motivo, horas }) => (
                  <li key={motivo}>
                    <span className="font-medium">{horas}</span> — {motivo}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {slots.length === 0 && loadingSlots ? (
            <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
              A carregar horários…
            </p>
          ) : slots.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
              Sem horários disponíveis neste dia.
            </p>
          ) : (
            <div
              aria-busy={loadingSlots}
              className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 transition-opacity ${
                loadingSlots ? "pointer-events-none opacity-40" : ""
              }`}
            >
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.startsAt)}
                  title={
                    slot.blockedReason
                      ? `Indisponível: ${slot.blockedReason}`
                      : !slot.available
                        ? "Horário já reservado"
                        : undefined
                  }
                  className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition disabled:cursor-not-allowed ${
                    selectedSlot === slot.startsAt
                      ? "border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600"
                      : slot.blockedReason
                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                        : "border-stone-300 bg-white text-stone-800 disabled:bg-stone-100 disabled:text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:disabled:bg-stone-800 dark:disabled:text-stone-600"
                  }`}
                >
                  {slot.blockedReason ? <Ban size={13} /> : null}
                  {slot.startsAt}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
          onSubmit={(event) => {
            event.preventDefault();
            submeter();
          }}
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800">
              <CalendarDays size={18} />
            </span>
            <div>
              <h2 className="font-semibold text-stone-950 dark:text-stone-100">
                Dados da marcação
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {selectedService?.nome} · {selectedSlot ?? "Escolha uma hora"}
              </p>
            </div>
          </div>
          <label className="mb-4 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Nome
            <Input
              className="mt-2"
              placeholder="O seu nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />
          </label>
          <label className="mb-5 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Telemóvel
            <Input
              className="mt-2"
              placeholder="+351 900 000 000"
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
            />
          </label>
          {erro ? (
            <p className="mb-4 text-sm font-medium text-red-700 dark:text-red-400">
              {erro}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={!selectedSlot || pending}
            className="w-full"
          >
            <Check size={16} />
            {pending ? "A confirmar…" : "Confirmar reserva"}
          </Button>
        </form>
      </section>
    </main>
  );
}
