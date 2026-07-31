"use client";

import type { ReservaEstado } from "@gestor/database";
import { addDays, dateKey } from "@gestor/utils";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Euro,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboardAction } from "../actions";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import type { DashboardData, ReservaAgendaView } from "../../lib/admin-data";

const ESTADO_LABEL: Record<ReservaEstado, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  concluida: "Concluída",
  no_show: "Não compareceu",
};

const ESTADO_CLASSE: Record<ReservaEstado, string> = {
  pendente:
    "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  confirmada: "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  cancelada: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  concluida:
    "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  no_show: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function formatarPreco(preco: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(preco);
}

function parseDia(dia: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, d ?? 1);
}

export function DashboardClient({
  diaInicial,
  dadosIniciais,
}: {
  diaInicial: string;
  dadosIniciais: DashboardData;
}) {
  const [dia, setDia] = useState(diaInicial);
  const [dados, setDados] = useState<DashboardData>(dadosIniciais);
  const [carregando, setCarregando] = useState(false);

  const diaRef = useRef(dia);
  useEffect(() => {
    diaRef.current = dia;
  }, [dia]);

  const carregar = useCallback(async (alvo: string) => {
    setCarregando(true);
    try {
      const resultado = await getDashboardAction(alvo);
      setDados(resultado);
    } finally {
      setCarregando(false);
    }
  }, []);

  const irPara = (novoDia: string) => {
    setDia(novoDia);
    void carregar(novoDia);
  };

  const shift = (delta: number) =>
    irPara(dateKey(addDays(parseDia(dia), delta)));

  // Atualização automática: realtime + polling de salvaguarda (recarrega o dia atual).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let ativo = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      if (!ativo) return;
      canal = supabase
        .channel("reservas-dashboard")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reservas" },
          () => {
            void carregar(diaRef.current);
          },
        )
        .subscribe();
    })();

    const intervalo = setInterval(() => void carregar(diaRef.current), 20000);

    return () => {
      ativo = false;
      if (canal) supabase.removeChannel(canal);
      clearInterval(intervalo);
    };
  }, [carregar]);

  const hojeKey = dateKey(new Date());
  const ehHoje = dia === hojeKey;
  const dataFormatada = parseDia(dia).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="lg:min-h-screen">
      <header className="border-b border-stone-200 bg-white px-4 py-5 sm:px-6 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">
            Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-md border border-stone-300 dark:border-stone-700">
              <button
                aria-label="Dia anterior"
                onClick={() => shift(-1)}
                className="p-2 text-stone-600 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                <ChevronLeft size={18} />
              </button>
              <span
                className="w-px bg-stone-200 dark:bg-stone-700"
                aria-hidden
              />
              <button
                aria-label="Dia seguinte"
                onClick={() => shift(1)}
                className="p-2 text-stone-600 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <span className="min-w-0 truncate text-sm font-medium capitalize text-stone-700 dark:text-stone-300">
              {dataFormatada}
            </span>
            {!ehHoje ? (
              <button
                type="button"
                onClick={() => irPara(hojeKey)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Hoje
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-5 p-4 sm:p-6">
        {/* KPIs do dia */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            titulo="Reservas"
            valor={String(dados.kpis.total)}
            detalhe="no dia"
            Icon={CalendarDays}
            cor="teal"
          />
          <KpiCard
            titulo="Por confirmar"
            valor={String(dados.kpis.pendentes)}
            detalhe="pendentes"
            Icon={Clock}
            cor="amber"
            destaque={dados.kpis.pendentes > 0}
          />
          <KpiCard
            titulo="Concluídas"
            valor={String(dados.kpis.concluidas)}
            detalhe="no dia"
            Icon={CheckCircle2}
            cor="indigo"
          />
          <KpiCard
            titulo="Receita"
            valor={formatarPreco(dados.kpis.receita)}
            detalhe="concluídas"
            Icon={Euro}
            cor="emerald"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Reservas do dia */}
          <div className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
              <h2 className="flex items-center gap-2 text-base font-semibold text-stone-950 dark:text-stone-100">
                <CalendarDays
                  size={18}
                  className="text-teal-700 dark:text-teal-400"
                />
                Reservas do dia
              </h2>
            </div>
            <div className="p-3 sm:p-4">
              {dados.reservasDia.length === 0 ? (
                <EstadoVazio
                  icon={CheckCircle2}
                  texto="Sem reservas neste dia."
                />
              ) : (
                <ul className="grid gap-2">
                  {dados.reservasDia.map((reserva) => (
                    <ReservaLinha key={reserva.id} reserva={reserva} />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Próximas marcações */}
          <div className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
              <h2 className="text-base font-semibold text-stone-950 dark:text-stone-100">
                Próximas marcações
              </h2>
              <button
                type="button"
                onClick={() => carregar(dia)}
                aria-label="Atualizar"
                title="Atualizar"
                className="rounded-md p-1.5 text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                <RefreshCw
                  size={15}
                  className={carregando ? "animate-spin" : ""}
                />
              </button>
            </div>
            <div className="p-3 sm:p-4">
              {dados.proximas.length === 0 ? (
                <EstadoVazio
                  icon={CalendarDays}
                  texto="Nada agendado para os próximos dias."
                />
              ) : (
                <ul className="grid gap-2">
                  {dados.proximas.map((reserva) => (
                    <li
                      key={reserva.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2.5 dark:border-stone-800"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                          {reserva.nomeCliente}
                        </p>
                        <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                          {reserva.servicoNome}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium capitalize text-stone-800 dark:text-stone-200">
                          {parseDia(reserva.data).toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {reserva.horaInicio}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const COR_CHIP: Record<string, string> = {
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  indigo:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
};

function KpiCard({
  titulo,
  valor,
  detalhe,
  Icon,
  cor,
  destaque,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  Icon: typeof CalendarDays;
  cor: keyof typeof COR_CHIP;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 transition dark:bg-stone-900 sm:p-5 ${
        destaque
          ? "border-amber-300 dark:border-amber-800/70"
          : "border-stone-200 dark:border-stone-800"
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${COR_CHIP[cor]}`}
      >
        <Icon size={18} />
      </span>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-stone-950 dark:text-stone-100 sm:text-3xl">
        {valor}
      </p>
      <p className="mt-0.5 text-sm font-medium text-stone-700 dark:text-stone-300">
        {titulo}
      </p>
      <p className="text-xs text-stone-400 dark:text-stone-500">{detalhe}</p>
    </div>
  );
}

function ReservaLinha({ reserva }: { reserva: ReservaAgendaView }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-2.5 dark:border-stone-800">
      <span className="inline-flex w-14 shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-stone-700 dark:text-stone-300">
        <Clock size={14} className="text-stone-400 dark:text-stone-500" />
        {reserva.horaInicio}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {reserva.nomeCliente}
        </p>
        <p className="truncate text-xs text-stone-500 dark:text-stone-400">
          {reserva.servicoNome}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${ESTADO_CLASSE[reserva.estado]}`}
      >
        {ESTADO_LABEL[reserva.estado]}
      </span>
    </li>
  );
}

function EstadoVazio({
  icon: Icon,
  texto,
}: {
  icon: typeof CalendarDays;
  texto: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500">
        <Icon size={20} />
      </span>
      <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
        {texto}
      </p>
    </div>
  );
}
