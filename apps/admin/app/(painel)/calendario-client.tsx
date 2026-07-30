"use client";

import { Button } from "@gestor/ui";
import type { ReservaEstado } from "@gestor/database";
import { dateKey } from "@gestor/utils";
import { ChevronLeft, ChevronRight, Clock, Phone, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { definirEstadoReservaAction } from "../actions";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type ReservaView = {
  id: string;
  horaInicio: string;
  horaFim: string;
  nomeCliente: string;
  telefoneCliente: string;
  servicoNome: string;
  estado: ReservaEstado;
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

export function CalendarioClient({ dia, reservas }: { dia: string; reservas: ReservaView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [emDireto, setEmDireto] = useState(false);

  // Realtime + polling de salvaguarda: a agenda atualiza sempre, mesmo que o
  // realtime não esteja disponível (ex.: tabela não publicada em supabase_realtime).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let ativo = true;

    (async () => {
      // O realtime precisa do JWT do admin para respeitar o RLS de `reservas`.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      if (!ativo) {
        return;
      }
      canal = supabase
        .channel("reservas-agenda")
        .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => {
          router.refresh();
        })
        .subscribe((status) => {
          setEmDireto(status === "SUBSCRIBED");
        });
    })();

    // Salvaguarda: garante frescura mesmo quando o realtime não entrega eventos.
    const intervalo = setInterval(() => router.refresh(), 15000);

    return () => {
      ativo = false;
      if (canal) {
        supabase.removeChannel(canal);
      }
      clearInterval(intervalo);
    };
  }, [router]);

  const irPara = (novoDia: string) => router.push(novoDia ? `/?d=${novoDia}` : "/");

  const shiftDay = (days: number) => {
    const base = parseDia(dia);
    base.setDate(base.getDate() + days);
    irPara(dateKey(base));
  };

  const mudarEstado = (id: string, estado: ReservaEstado) => {
    setErro(null);
    startTransition(async () => {
      const resultado = await definirEstadoReservaAction(id, estado);
      if (resultado.ok) {
        router.refresh();
      } else {
        setErro(resultado.erro);
      }
    });
  };

  const accoesPorEstado = (estado: ReservaEstado): { estado: ReservaEstado; label: string; variant: "primary" | "secondary" | "danger" }[] => {
    if (estado === "pendente") {
      return [
        { estado: "confirmada", label: "Confirmar", variant: "primary" },
        { estado: "cancelada", label: "Cancelar", variant: "danger" },
      ];
    }
    if (estado === "confirmada") {
      return [
        { estado: "concluida", label: "Concluir", variant: "primary" },
        { estado: "no_show", label: "Faltou", variant: "secondary" },
        { estado: "cancelada", label: "Cancelar", variant: "danger" },
      ];
    }
    return [];
  };

  return (
    <section className="lg:min-h-screen">
      <header className="flex flex-col gap-4 border-b border-stone-200 bg-white px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button aria-label="Dia anterior" onClick={() => shiftDay(-1)} className="rounded-md border border-stone-300 p-2">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="text-sm text-stone-500">Agenda</p>
            <h2 className="text-xl font-semibold capitalize text-stone-950">
              {parseDia(dia).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}
            </h2>
          </div>
          <button aria-label="Dia seguinte" onClick={() => shiftDay(1)} className="rounded-md border border-stone-300 p-2">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
              emDireto ? "bg-teal-50 text-teal-800" : "bg-stone-100 text-stone-500"
            }`}
            title={
              emDireto
                ? "A receber alterações em tempo real"
                : "Sem realtime — a atualizar automaticamente a cada 15s"
            }
          >
            <span className={`h-2 w-2 rounded-full ${emDireto ? "bg-teal-600" : "bg-stone-400"}`} />
            {emDireto ? "Em direto" : "Automático"}
          </span>
          <Button type="button" variant="secondary" onClick={() => irPara(dateKey(new Date()))}>
            Hoje
          </Button>
          <button
            type="button"
            onClick={() => router.refresh()}
            aria-label="Atualizar"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 px-3 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </header>

      <div className="grid gap-3 p-5">
        {erro ? <p className="text-sm font-medium text-red-700">{erro}</p> : null}
        {reservas.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">Sem reservas neste dia.</p>
        ) : (
          reservas.map((reserva) => (
            <div
              key={reserva.id}
              className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 md:grid md:grid-cols-[90px_1fr_auto] md:items-center md:gap-4"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <Clock size={15} />
                {reserva.horaInicio}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-stone-950">{reserva.nomeCliente}</p>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ESTADO_CLASSE[reserva.estado]}`}>
                    {ESTADO_LABEL[reserva.estado]}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-stone-500">
                  <span>{reserva.servicoNome}</span>
                  <span className="inline-flex items-center gap-1">
                    <Phone size={13} />
                    {reserva.telefoneCliente}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {accoesPorEstado(reserva.estado).map((accao) => (
                  <Button
                    key={accao.estado}
                    type="button"
                    variant={accao.variant}
                    disabled={pending}
                    onClick={() => mudarEstado(reserva.id, accao.estado)}
                  >
                    {accao.label}
                  </Button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
