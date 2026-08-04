"use client";

import { Button, Input } from "@gestor/ui";
import type { ReservaEstado } from "@gestor/database";
import { addDays, dateKey, generateMonthGrid, startOfWeek } from "@gestor/utils";
import { ChevronLeft, ChevronRight, Clock, Phone, Plus, RefreshCw, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  criarMarcacaoAdminAction,
  definirEstadoReservaAction,
  getReservasIntervaloAction,
} from "../actions";
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
  profissionalNome: string | null;
  estado: ReservaEstado;
};

type ServicoOpcao = { id: string; nome: string; duracaoMinutos: number };
type EquipaOpcao = { id: string; nome: string };

const ESTADO_LABEL: Record<ReservaEstado, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  concluida: "Concluída",
  no_show: "Não compareceu",
};

const ESTADO_CLASSE: Record<ReservaEstado, string> = {
  pendente: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  confirmada: "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300",
  cancelada: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  concluida: "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300",
  no_show: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
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
  servicos,
  equipa,
}: {
  diaInicial: string;
  vistaInicial: Vista;
  reservasIniciais: ReservaView[];
  servicos: ServicoOpcao[];
  equipa: EquipaOpcao[];
}) {
  const [dia, setDia] = useState(diaInicial);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [reservas, setReservas] = useState<ReservaView[]>(reservasIniciais);
  const [novaAberta, setNovaAberta] = useState(false);
  // Dia escolhido dentro da grelha mensal (não muda de vista nem refaz a busca:
  // as reservas do mês inteiro já estão carregadas).
  const [diaFocado, setDiaFocado] = useState<string | null>(null);
  const [estadosVisiveis, setEstadosVisiveis] = useState<ReservaEstado[]>(ESTADOS_POR_OMISSAO);
  const [carregando, setCarregando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

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
    window.history.replaceState(null, "", `/agenda?d=${dia}&v=${vista}`);
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
        .subscribe();
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
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Navegação + período atual */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-md border border-stone-300 dark:border-stone-700">
              <button
                aria-label="Anterior"
                onClick={() => shift(-1)}
                className="p-2 text-stone-600 dark:text-stone-400 transition hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="w-px bg-stone-200" aria-hidden />
              <button
                aria-label="Seguinte"
                onClick={() => shift(1)}
                className="p-2 text-stone-600 dark:text-stone-400 transition hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <h2 className="ml-1 truncate text-lg font-semibold capitalize text-stone-950 dark:text-stone-100 sm:text-xl">{titulo}</h2>
          </div>

          {/* Controlos */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid flex-1 grid-cols-3 gap-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 p-1 text-sm sm:flex sm:flex-none">
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => irPara(dia, v)}
                  aria-pressed={vista === v}
                  className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
                    vista === v
                      ? "bg-white dark:bg-stone-950 text-stone-950 dark:text-stone-100 shadow-sm"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                  }`}
                >
                  {v === "mes" ? "Mês" : v}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => atualizar(dia, vista)}
                aria-label="Atualizar"
                title="Atualizar agora"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-300 transition hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <RefreshCw size={15} className={pending || carregando ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <Button type="button" onClick={() => setNovaAberta(true)} disabled={servicos.length === 0}>
                <Plus size={16} />
                <span className="hidden sm:inline">Nova marcação</span>
                <span className="sm:hidden">Nova</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filtro por estado */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-stone-100 dark:border-stone-800 pt-3">
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
                    ? "border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-300"
                    : "border-transparent bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${ativo ? ESTADO_PONTO[estado] : "bg-stone-300 dark:bg-stone-600"}`} />
                {ESTADO_LABEL[estado]}
                {total > 0 ? <span className={ativo ? "text-stone-500 dark:text-stone-400" : ""}>{total}</span> : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid gap-3 p-5">
        {erro ? <p className="text-sm font-medium text-red-700 dark:text-red-400">{erro}</p> : null}

        {!estadosVisiveis.includes("pendente") && (contagens.get("pendente") ?? 0) > 0 ? (
          <button
            type="button"
            onClick={() => alternarEstado("pendente")}
            className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-left text-sm text-amber-900 dark:text-amber-300 transition hover:bg-amber-100 dark:hover:bg-amber-900/30"
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
              <h3 className="mb-3 text-sm font-semibold capitalize text-stone-800 dark:text-stone-300">
                {parseDia(diaAtivo).toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
                <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
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

      {novaAberta ? (
        <NovaMarcacaoDialog
          diaInicial={diaAtivo}
          servicos={servicos}
          equipa={equipa}
          onFechar={() => setNovaAberta(false)}
          onCriada={(diaCriado) => {
            setNovaAberta(false);
            // Salta para o dia da marcação criada e recarrega a agenda.
            irPara(diaCriado, vista);
          }}
        />
      ) : null}
    </section>
  );
}

function NovaMarcacaoDialog({
  diaInicial,
  servicos,
  equipa,
  onFechar,
  onCriada,
}: {
  diaInicial: string;
  servicos: ServicoOpcao[];
  equipa: EquipaOpcao[];
  onFechar: () => void;
  onCriada: (dia: string) => void;
}) {
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");
  const [profissionalId, setProfissionalId] = useState("");
  const [dia, setDia] = useState(diaInicial);
  const [hora, setHora] = useState("09:00");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectClasse =
    "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:border-teal-500 dark:focus:ring-teal-900/40";

  const submeter = () => {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarMarcacaoAdminAction({
        servicoId,
        dia,
        hora,
        nome,
        telefone,
        profissionalId: profissionalId || null,
      });
      if (resultado.ok) {
        onCriada(dia);
      } else {
        setErro(resultado.erro);
      }
    });
  };

  const podeSubmeter = Boolean(servicoId && dia && hora && nome.trim().length >= 2);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-white dark:bg-stone-900 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-stone-200 sm:dark:border-stone-800">
        <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <h2 className="text-lg font-semibold text-stone-950 dark:text-stone-100">Nova marcação</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
            Serviço
            <select
              className={`mt-2 ${selectClasse}`}
              value={servicoId}
              onChange={(e) => setServicoId(e.target.value)}
            >
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · {s.duracaoMinutos} min
                </option>
              ))}
            </select>
          </label>

          {equipa.length > 0 ? (
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Profissional
              <select
                className={`mt-2 ${selectClasse}`}
                value={profissionalId}
                onChange={(e) => setProfissionalId(e.target.value)}
              >
                <option value="">Sem preferência</option>
                {equipa.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Dia
              <Input
                type="date"
                className="mt-2"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Hora
              <Input
                type="time"
                className="mt-2"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
            Nome do cliente
            <Input
              className="mt-2"
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
            Telemóvel <span className="font-normal text-stone-400">(opcional)</span>
            <Input
              type="tel"
              className="mt-2"
              placeholder="Telemóvel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </label>

          {erro ? (
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{erro}</p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-stone-200 p-3 dark:border-stone-800">
          <Button type="button" variant="secondary" onClick={onFechar} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={submeter} disabled={pending || !podeSubmeter}>
            {pending ? "A criar…" : "Criar marcação"}
          </Button>
        </footer>
      </div>
    </div>
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
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 md:grid md:grid-cols-[90px_1fr_auto] md:items-center md:gap-4">
      <span className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
        <Clock size={15} />
        {reserva.horaInicio}
      </span>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-stone-950 dark:text-stone-100">{reserva.nomeCliente}</p>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ESTADO_CLASSE[reserva.estado]}`}>
            {ESTADO_LABEL[reserva.estado]}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-stone-500 dark:text-stone-400">
          <span>{reserva.servicoNome}</span>
          {reserva.profissionalNome ? (
            <span className="inline-flex items-center gap-1">
              <User size={13} />
              {reserva.profissionalNome}
            </span>
          ) : null}
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
    return <p className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-stone-600 dark:text-stone-400">Sem reservas neste dia.</p>;
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
              <span className={`text-sm font-semibold capitalize ${ehHoje ? "text-teal-700 dark:text-teal-400" : "text-stone-800 dark:text-stone-300"}`}>
                {DIAS_SEMANA_LONGO[data.getDay()]}, {data.getDate()}
              </span>
              {reservasDoDia.length > 0 ? (
                <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                  {reservasDoDia.length}
                </span>
              ) : null}
            </button>
            <div className="grid gap-2">
              {reservasDoDia.length === 0 ? (
                <p className="rounded-md border border-dashed border-stone-200 dark:border-stone-800 px-4 py-3 text-sm text-stone-400 dark:text-stone-500">
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
    <div className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-center text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
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
              className={`flex h-20 flex-col items-start gap-1 border-b border-r border-stone-100 dark:border-stone-800 p-1.5 text-left transition hover:bg-stone-50 dark:hover:bg-stone-800 sm:h-24 sm:p-2 ${
                inMonth ? "bg-white dark:bg-stone-900" : "bg-stone-50/60 dark:bg-stone-900/40"
              } ${ehSelecionado ? "ring-2 ring-inset ring-teal-600 dark:ring-teal-500" : ""}`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  ehHoje ? "bg-teal-700 dark:bg-teal-600 text-white" : inMonth ? "text-stone-700 dark:text-stone-300" : "text-stone-400 dark:text-stone-500"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="flex w-full flex-1 flex-col gap-0.5 overflow-hidden">
                {reservasDoDia.slice(0, 2).map((reserva) => (
                  <span key={reserva.id} className="flex items-center gap-1 truncate text-[11px] text-stone-600 dark:text-stone-400">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ESTADO_PONTO[reserva.estado]}`} />
                    <span className="truncate">{reserva.horaInicio}</span>
                  </span>
                ))}
                {reservasDoDia.length > 2 ? (
                  <span className="text-[11px] text-stone-400 dark:text-stone-500">+{reservasDoDia.length - 2}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
