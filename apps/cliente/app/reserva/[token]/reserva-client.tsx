"use client";

import { Button } from "@gestor/ui";
import type { ReservaEstado } from "@gestor/database";
import { dateKey, type Slot } from "@gestor/utils";
import { CalendarCheck, CalendarX, Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  cancelarReservaAction,
  confirmarReservaAction,
  getSlotsAction,
  reagendarReservaAction,
} from "../../actions";
import { NotificacoesButton } from "../../notificacoes-button";

type ReservaView = {
  token: string;
  servicoId: string;
  servicoNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  nomeCliente: string;
  estado: ReservaEstado;
  confirmadoPeloCliente: boolean;
};

const ESTADO_LABEL: Record<ReservaEstado, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  concluida: "Concluída",
  no_show: "Não compareceu",
};

const ESTADO_CLASSE: Record<ReservaEstado, string> = {
  pendente: "bg-amber-50 text-amber-800",
  confirmada: "bg-teal-50 text-teal-800",
  cancelada: "bg-red-50 text-red-700",
  concluida: "bg-stone-100 text-stone-700",
  no_show: "bg-red-50 text-red-700",
};

function parseDia(dia: string): Date {
  const [ano, mes, d07] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, d07 ?? 1);
}

function formatarData(dia: string): string {
  return parseDia(dia).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function ReservaClient({ reserva, novo }: { reserva: ReservaView; novo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aReagendar, setAReagendar] = useState(false);
  const [date, setDate] = useState(() => parseDia(reserva.data));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [novoSlot, setNovoSlot] = useState<string | null>(null);

  const ativa = reserva.estado === "pendente" || reserva.estado === "confirmada";

  // Mantém a reserva sincronizada com o admin: refresca ao receber um push
  // e por polling leve enquanto a página está visível.
  useEffect(() => {
    const refrescar = () => router.refresh();
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "reserva-atualizada") {
        refrescar();
      }
    };
    const onVisivel = () => {
      if (document.visibilityState === "visible") {
        refrescar();
      }
    };
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    sw?.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisivel);
    const intervalo = setInterval(refrescar, 15000);
    return () => {
      sw?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisivel);
      clearInterval(intervalo);
    };
  }, [router]);

  useEffect(() => {
    if (!aReagendar) {
      return;
    }
    let cancelado = false;
    setLoadingSlots(true);
    getSlotsAction(reserva.servicoId, dateKey(date))
      .then((resultado) => {
        if (!cancelado) setSlots(resultado);
      })
      .catch(() => {
        if (!cancelado) setSlots([]);
      })
      .finally(() => {
        if (!cancelado) setLoadingSlots(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aReagendar, date, reserva.servicoId]);

  const shiftDay = (days: number) => {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    setDate(next);
    setNovoSlot(null);
  };

  const executar = (accao: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null);
    startTransition(async () => {
      const resultado = await accao();
      if (resultado.ok) {
        setAReagendar(false);
        router.refresh();
      } else {
        setErro(resultado.erro ?? "Ocorreu um erro.");
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-5 py-10">
      {novo ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-800">
          Reserva criada com sucesso! Guarde este link para gerir a sua marcação.
        </div>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-teal-700">Reserva</p>
          <span className={`rounded-md px-2 py-1 text-xs font-medium ${ESTADO_CLASSE[reserva.estado]}`}>
            {ESTADO_LABEL[reserva.estado]}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">{reserva.servicoNome}</h1>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Cliente</dt>
            <dd className="font-medium text-stone-800">{reserva.nomeCliente}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Data</dt>
            <dd className="font-medium capitalize text-stone-800">{formatarData(reserva.data)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Hora</dt>
            <dd className="font-medium text-stone-800">
              {reserva.horaInicio} – {reserva.horaFim}
            </dd>
          </div>
        </dl>

        {erro ? <p className="mt-4 text-sm font-medium text-red-700">{erro}</p> : null}

        {ativa ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {reserva.estado === "pendente" && !reserva.confirmadoPeloCliente ? (
              <Button type="button" disabled={pending} onClick={() => executar(() => confirmarReservaAction(reserva.token))}>
                <Check size={16} />
                Confirmar reserva
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setAReagendar((v) => !v);
                setNovoSlot(null);
              }}
            >
              <RotateCcw size={16} />
              Reagendar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={() => executar(() => cancelarReservaAction(reserva.token))}
            >
              <CalendarX size={16} />
              Cancelar
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-stone-500">Esta reserva já não pode ser alterada.</p>
        )}

        {ativa ? (
          <div className="mt-6 border-t border-stone-200 pt-4">
            <p className="mb-3 text-sm text-stone-500">Quer ser avisado sobre alterações a esta reserva?</p>
            <NotificacoesButton token={reserva.token} />
          </div>
        ) : null}
      </section>

      {aReagendar && ativa ? (
        <section className="rounded-lg border border-stone-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <button aria-label="Dia anterior" onClick={() => shiftDay(-1)} className="rounded-md border border-stone-300 p-2">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm text-stone-500">Novo dia</p>
              <h2 className="text-lg font-semibold capitalize text-stone-950">
                {date.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}
              </h2>
            </div>
            <button aria-label="Dia seguinte" onClick={() => shiftDay(1)} className="rounded-md border border-stone-300 p-2">
              <ChevronRight size={18} />
            </button>
          </div>

          {loadingSlots ? (
            <p className="py-6 text-center text-sm text-stone-500">A carregar horários…</p>
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-500">Sem horários disponíveis neste dia.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  disabled={!slot.available}
                  onClick={() => setNovoSlot(slot.startsAt)}
                  className={`h-11 rounded-md border text-sm font-medium transition disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${
                    novoSlot === slot.startsAt ? "border-teal-700 bg-teal-700 text-white" : "border-stone-300 bg-white text-stone-800"
                  }`}
                >
                  {slot.startsAt}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            disabled={!novoSlot || pending}
            className="mt-5 w-full"
            onClick={() => {
              if (novoSlot) {
                executar(() => reagendarReservaAction(reserva.token, dateKey(date), novoSlot));
              }
            }}
          >
            <CalendarCheck size={16} />
            Confirmar novo horário
          </Button>
        </section>
      ) : null}
    </main>
  );
}
