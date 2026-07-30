"use client";

import { Button } from "@gestor/ui";
import type { ReservaEstado } from "@gestor/database";
import { addDays, dateKey, generateMonthGrid, startOfWeek } from "@gestor/utils";
import { ChevronLeft, ChevronRight, Clock, Phone, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { definirEstadoReservaAction, getReservasIntervaloAction } from "../actions";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { calcularIntervalo, parseDia, type Vista } from "./calendar-range";

type ReservaView = {
  id: string;
  data: string;
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

const ESTADO_PONTO: Record<ReservaEstado, string> = {
  pendente: "bg-amber-500",
  confirmada: "bg-teal-600",
  cancelada: "bg-red-400",
  concluida: "bg-stone-400",
  no_show: "bg-red-400",
};

/** Estados visíveis por omissão: esconde o "ruído" de canceladas/concluídas. */
const ESTADOS_POR_OMISSAO: ReservaEstado[] = ["confirmada"];

const ESTADOS_FILTRO: ReservaEstado[] = ["pendente", "confirmada", "concluida", "cancelada", "no_show"];

const DIAS_SEMANA_LONGO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_SEMANA_CURTO_SEG = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Accao = { estado: ReservaEstado; label: string; variant: "primary" | "secondary" | "danger" };

function accoesPorEstado(estado: ReservaEstado): Accao[] {
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
}

export function CalendarioClient({
  diaInicial,
  vistaInicial,
  reservasIniciais,
}: {
  diaInicial: string;
  vistaInicial: Vista;
  reservasIniciais: ReservaView[];
}) {
  const [dia, setDia] = useState(diaInicial);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [reservas, setReservas] = useState<ReservaView[]>(reservasIniciais);
  // Dia escolhido dentro da grelha mensal (não muda de vista nem refaz a busca:
  // as reservas do mês inteiro já estão carregadas).
  const [diaFocado, setDiaFocado] = useState<string | null>(null);
  const [estadosVisiveis, setEstadosVisiveis] = useState<ReservaEstado[]>(ESTADOS_POR_OMISSAO);
  const [carregando, setCarregando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [emDireto, setEmDireto] = useState(false);

  // Refs para os handlers de realtime/polling lerem sempre o dia/vista atuais
  // sem precisar de resubscrever o canal a cada troca.
  const diaRef = useRef(dia);
  const vistaRef = useRef(vista);
  useEffect(() => {
    diaRef.current = dia;
    vistaRef.current = vista;
  }, [dia, vista]);

  // Mantém o URL partilhável, sem provocar navegação nem refetch da rota.
  useEffect(() => {
    window.history.replaceState(null, "", `/?d=${dia}&v=${vista}`);
  }, [dia, vista]);

  // Busca silenciosa: atualiza os dados em memória, sem navegar nem recarregar a página.
  const atualizar = useCallback(async (novoDia: string, novaVista: Vista) => {
    const { from, to } = calcularIntervalo(novoDia, novaVista);
    setCarregando(true);
    try {
      const resultado = await getReservasIntervaloAction(from, to);
      setReservas(resultado);
    } catch {
      setErro("Não foi possível atualizar a agenda.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Realtime + polling de salvaguarda — ambos atualizam os dados em memória.
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
          void atualizar(diaRef.current, vistaRef.current);
        })
        .subscribe((status) => {
          setEmDireto(status === "SUBSCRIBED");
        });
    })();

    // Salvaguarda: garante frescura mesmo quando o realtime não entrega eventos.
    const intervalo = setInterval(() => {
      void atualizar(diaRef.current, vistaRef.current);
    }, 15000);

    return () => {
      ativo = false;
      if (canal) {
        supabase.removeChannel(canal);
      }
      clearInterval(intervalo);
    };
  }, [atualizar]);

  // Contagens sobre o conjunto completo, para os chips mostrarem o que está escondido.
  const contagens = useMemo(() => {
    const mapa = new Map<ReservaEstado, number>();
    for (const reserva of reservas) {
      mapa.set(reserva.estado, (mapa.get(reserva.estado) ?? 0) + 1);
    }
    return mapa;
  }, [reservas]);

  const reservasVisiveis = useMemo(
    () => reservas.filter((reserva) => estadosVisiveis.includes(reserva.estado)),
    [reservas, estadosVisiveis],
  );

  const alternarEstado = (estado: ReservaEstado) =>
    setEstadosVisiveis((atual) =>
      atual.includes(estado) ? atual.filter((e) => e !== estado) : [...atual, estado],
    );

  const porData = useMemo(() => {
    const mapa = new Map<string, ReservaView[]>();
    for (const reserva of reservasVisiveis) {
      const lista = mapa.get(reserva.data) ?? [];
      lista.push(reserva);
      mapa.set(reserva.data, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return mapa;
  }, [reservasVisiveis]);

  const irPara = (novoDia: string, novaVista: Vista = vista) => {
    setDia(novoDia);
    setVista(novaVista);
    setDiaFocado(null);
    void atualizar(novoDia, novaVista);
  };

  const shift = (delta: number) => {
    const base = parseDia(dia);
    if (vista === "dia") {
      base.setDate(base.getDate() + delta);
    } else if (vista === "semana") {
      base.setDate(base.getDate() + delta * 7);
    } else {
      base.setMonth(base.getMonth() + delta, 1);
    }
    irPara(dateKey(base));
  };

  const mudarEstado = (id: string, estado: ReservaEstado) => {
    setErro(null);
    startTransition(async () => {
      const resultado = await definirEstadoReservaAction(id, estado);
      if (resultado.ok) {
        await atualizar(dia, vista);
      } else {
        setErro(resultado.erro);
      }
    });
  };

  const hojeKey = dateKey(new Date());
  // Na vista mensal, o dia cujas reservas são listadas em baixo.
  const diaAtivo = diaFocado ?? dia;

  const titulo = useMemo(() => {
    if (vista === "dia") {
      return parseDia(dia).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" });
    }
    if (vista === "semana") {
      const inicio = startOfWeek(parseDia(dia));
      const fim = addDays(inicio, 6);
      const fmtInicio = inicio.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
      const fmtFim = fim.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
      return `${fmtInicio} – ${fmtFim}`;
    }
    return parseDia(dia).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  }, [dia, vista]);

  return (
    <section className="lg:min-h-screen">
      <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Navegação + período atual */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-md border border-stone-300">
              <button
                aria-label="Anterior"
                onClick={() => shift(-1)}
                className="p-2 text-stone-600 transition hover:bg-stone-50"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="w-px bg-stone-200" aria-hidden />
              <button
                aria-label="Seguinte"
                onClick={() => shift(1)}
                className="p-2 text-stone-600 transition hover:bg-stone-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <h2 className="ml-1 truncate text-lg font-semibold capitalize text-stone-950 sm:text-xl">{titulo}</h2>
          </div>

          {/* Controlos */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid flex-1 grid-cols-3 gap-0.5 rounded-lg bg-stone-100 p-1 text-sm sm:flex sm:flex-none">
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => irPara(dia, v)}
                  aria-pressed={vista === v}
                  className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
                    vista === v
                      ? "bg-white text-stone-950 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {v === "mes" ? "Mês" : v}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => irPara(hojeKey)}>
                Hoje
              </Button>
              <button
                type="button"
                onClick={() => atualizar(dia, vista)}
                aria-label="Atualizar"
                title="Atualizar agora"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 px-3 text-sm text-stone-700 transition hover:bg-stone-50"
              >
                <RefreshCw size={15} className={pending || carregando ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <span
                className={`inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
                  emDireto ? "bg-teal-50 text-teal-800" : "bg-stone-100 text-stone-500"
                }`}
                title={
                  emDireto
                    ? "A receber alterações em tempo real"
                    : "Sem realtime — a atualizar automaticamente a cada 15s"
                }
              >
                <span
                  className={`h-2 w-2 rounded-full ${emDireto ? "animate-pulse bg-teal-600" : "bg-stone-400"}`}
                  aria-hidden
                />
                <span className="hidden sm:inline">{emDireto ? "Em direto" : "Automático"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Filtro por estado */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-stone-400">Mostrar</span>
          {ESTADOS_FILTRO.map((estado) => {
            const ativo = estadosVisiveis.includes(estado);
            const total = contagens.get(estado) ?? 0;
            return (
              <button
                key={estado}
                type="button"
                onClick={() => alternarEstado(estado)}
                aria-pressed={ativo}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  ativo
                    ? "border-stone-300 bg-white text-stone-800"
                    : "border-transparent bg-stone-100 text-stone-400 hover:text-stone-600"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${ativo ? ESTADO_PONTO[estado] : "bg-stone-300"}`} />
                {ESTADO_LABEL[estado]}
                {total > 0 ? <span className={ativo ? "text-stone-500" : ""}>{total}</span> : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid gap-3 p-5">
        {erro ? <p className="text-sm font-medium text-red-700">{erro}</p> : null}

        {!estadosVisiveis.includes("pendente") && (contagens.get("pendente") ?? 0) > 0 ? (
          <button
            type="button"
            onClick={() => alternarEstado("pendente")}
            className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-900 transition hover:bg-amber-100"
          >
            <Clock size={15} />
            <span>
              <strong>{contagens.get("pendente")}</strong> reserva(s) pendente(s) por confirmar estão escondidas —
              mostrar
            </span>
          </button>
        ) : null}

        {vista === "dia" ? (
          <DiaLista reservas={porData.get(dia) ?? []} pending={pending} onMudarEstado={mudarEstado} />
        ) : null}

        {vista === "semana" ? (
          <SemanaLista
            dia={dia}
            porData={porData}
            pending={pending}
            hojeKey={hojeKey}
            onMudarEstado={mudarEstado}
            onSelecionarDia={(d) => irPara(d, "dia")}
          />
        ) : null}

        {vista === "mes" ? (
          <>
            <MesGrelha
              dia={dia}
              diaFocado={diaAtivo}
              porData={porData}
              hojeKey={hojeKey}
              onSelecionarDia={setDiaFocado}
            />
            <div className="mt-2">
              <h3 className="mb-3 text-sm font-semibold capitalize text-stone-800">
                {parseDia(diaAtivo).toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
                <span className="ml-2 font-normal text-stone-500">
                  {(porData.get(diaAtivo) ?? []).length} reserva(s)
                </span>
              </h3>
              <div className="grid gap-2">
                <DiaLista reservas={porData.get(diaAtivo) ?? []} pending={pending} onMudarEstado={mudarEstado} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function ReservaRow({
  reserva,
  pending,
  onMudarEstado,
}: {
  reserva: ReservaView;
  pending: boolean;
  onMudarEstado: (id: string, estado: ReservaEstado) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 md:grid md:grid-cols-[90px_1fr_auto] md:items-center md:gap-4">
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
            onClick={() => onMudarEstado(reserva.id, accao.estado)}
          >
            {accao.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DiaLista({
  reservas,
  pending,
  onMudarEstado,
}: {
  reservas: ReservaView[];
  pending: boolean;
  onMudarEstado: (id: string, estado: ReservaEstado) => void;
}) {
  if (reservas.length === 0) {
    return <p className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">Sem reservas neste dia.</p>;
  }
  return (
    <>
      {reservas.map((reserva) => (
        <ReservaRow key={reserva.id} reserva={reserva} pending={pending} onMudarEstado={onMudarEstado} />
      ))}
    </>
  );
}

function SemanaLista({
  dia,
  porData,
  pending,
  hojeKey,
  onMudarEstado,
  onSelecionarDia,
}: {
  dia: string;
  porData: Map<string, ReservaView[]>;
  pending: boolean;
  hojeKey: string;
  onMudarEstado: (id: string, estado: ReservaEstado) => void;
  onSelecionarDia: (dia: string) => void;
}) {
  const inicio = startOfWeek(parseDia(dia));
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));

  return (
    <div className="grid gap-5">
      {dias.map((data) => {
        const key = dateKey(data);
        const reservasDoDia = porData.get(key) ?? [];
        const ehHoje = key === hojeKey;
        return (
          <div key={key}>
            <button onClick={() => onSelecionarDia(key)} className="mb-2 flex items-center gap-2 text-left">
              <span className={`text-sm font-semibold capitalize ${ehHoje ? "text-teal-700" : "text-stone-800"}`}>
                {DIAS_SEMANA_LONGO[data.getDay()]}, {data.getDate()}
              </span>
              {reservasDoDia.length > 0 ? (
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                  {reservasDoDia.length}
                </span>
              ) : null}
            </button>
            <div className="grid gap-2">
              {reservasDoDia.length === 0 ? (
                <p className="rounded-md border border-dashed border-stone-200 px-4 py-3 text-sm text-stone-400">
                  Sem reservas
                </p>
              ) : (
                reservasDoDia.map((reserva) => (
                  <ReservaRow key={reserva.id} reserva={reserva} pending={pending} onMudarEstado={onMudarEstado} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MesGrelha({
  dia,
  diaFocado,
  porData,
  hojeKey,
  onSelecionarDia,
}: {
  dia: string;
  diaFocado: string;
  porData: Map<string, ReservaView[]>;
  hojeKey: string;
  onSelecionarDia: (dia: string) => void;
}) {
  const grelha = generateMonthGrid(parseDia(dia));

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-medium uppercase tracking-wide text-stone-400">
        {DIAS_SEMANA_CURTO_SEG.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grelha.map(({ date, inMonth }) => {
          const key = dateKey(date);
          const reservasDoDia = porData.get(key) ?? [];
          const ehHoje = key === hojeKey;
          const ehSelecionado = key === diaFocado;
          return (
            <button
              key={key}
              onClick={() => onSelecionarDia(key)}
              aria-pressed={ehSelecionado}
              className={`flex h-20 flex-col items-start gap-1 border-b border-r border-stone-100 p-1.5 text-left transition hover:bg-stone-50 sm:h-24 sm:p-2 ${
                inMonth ? "bg-white" : "bg-stone-50/60"
              } ${ehSelecionado ? "ring-2 ring-inset ring-teal-600" : ""}`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  ehHoje ? "bg-teal-700 text-white" : inMonth ? "text-stone-700" : "text-stone-400"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="flex w-full flex-1 flex-col gap-0.5 overflow-hidden">
                {reservasDoDia.slice(0, 2).map((reserva) => (
                  <span key={reserva.id} className="flex items-center gap-1 truncate text-[11px] text-stone-600">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ESTADO_PONTO[reserva.estado]}`} />
                    <span className="truncate">{reserva.horaInicio}</span>
                  </span>
                ))}
                {reservasDoDia.length > 2 ? (
                  <span className="text-[11px] text-stone-400">+{reservasDoDia.length - 2}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
