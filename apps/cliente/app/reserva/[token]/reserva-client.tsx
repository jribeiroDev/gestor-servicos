"use client";

import { Button, Input, ThemeToggle } from "@gestor/ui";
import type { ReservaEstado } from "@gestor/database";
import { dateKey, type Slot } from "@gestor/utils";
import {
  ArrowLeft,
  Ban,
  CalendarCheck,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  cancelarReservaAction,
  confirmarReservaAction,
  getReservaViewAction,
  getSlotsAction,
  reagendarReservaAction,
  type ReservaView,
} from "../../actions";
import { NotificacoesButton } from "../../notificacoes-button";

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

export function ReservaClient({
  reserva: reservaInicial,
  novo,
}: {
  reserva: ReservaView;
  novo: boolean;
}) {
  const [reserva, setReserva] = useState(reservaInicial);
  const [aSincronizar, setASincronizar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null);
  const [origem, setOrigem] = useState("");
  const copiadoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkInput = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aReagendar, setAReagendar] = useState(false);
  const [date, setDate] = useState(() => parseDia(reservaInicial.data));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [novoSlot, setNovoSlot] = useState<string | null>(null);

  const ativa =
    reserva.estado === "pendente" || reserva.estado === "confirmada";
  const tokenRef = useRef(reserva.token);

  // Só no cliente — evita divergência entre servidor e browser na hidratação.
  useEffect(() => {
    setOrigem(window.location.origin);
    return () => {
      if (copiadoTimeout.current) {
        clearTimeout(copiadoTimeout.current);
      }
    };
  }, []);

  // Busca silenciosa: atualiza os dados em memória, sem navegar nem recarregar a página.
  const sincronizar = useCallback(async () => {
    setASincronizar(true);
    try {
      const atual = await getReservaViewAction(tokenRef.current);
      if (atual) {
        setReserva(atual);
      }
    } finally {
      setASincronizar(false);
    }
  }, []);

  // Mantém a reserva sincronizada com o admin: sincroniza ao receber um push
  // e por polling leve enquanto a página está visível — sem router.refresh().
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        (event.data as { type?: string } | null)?.type === "reserva-atualizada"
      ) {
        void sincronizar();
      }
    };
    const onVisivel = () => {
      if (document.visibilityState === "visible") {
        void sincronizar();
      }
    };
    const sw =
      typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    sw?.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisivel);
    const intervalo = setInterval(() => void sincronizar(), 15000);
    return () => {
      sw?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisivel);
      clearInterval(intervalo);
    };
  }, [sincronizar]);

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
        await sincronizar();
      } else {
        setErro(resultado.erro ?? "Ocorreu um erro.");
      }
    });
  };

  // Link limpo da reserva (sem parâmetros como ?novo=1).
  const linkReserva = `${origem}/reserva/${reserva.token}`;

  const copiarLink = async () => {
    setAvisoCopia(null);

    // A Clipboard API só existe em contexto seguro (https/localhost); em acesso
    // por IP na rede local recorremos à seleção + execCommand.
    const porClipboardApi = async () => {
      if (!navigator.clipboard?.writeText) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(linkReserva);
        return true;
      } catch {
        return false;
      }
    };

    const porSelecao = () => {
      const campo = linkInput.current;
      if (!campo) {
        return false;
      }
      try {
        campo.focus();
        campo.select();
        campo.setSelectionRange(0, linkReserva.length);
        return document.execCommand("copy");
      } catch {
        return false;
      }
    };

    if ((await porClipboardApi()) || porSelecao()) {
      setCopiado(true);
      if (copiadoTimeout.current) {
        clearTimeout(copiadoTimeout.current);
      }
      copiadoTimeout.current = setTimeout(() => setCopiado(false), 2000);
      return;
    }

    linkInput.current?.select();
    setAvisoCopia(
      "O link está selecionado — use Ctrl+C (ou toque longo → Copiar).",
    );
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-5 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-stone-600 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
        >
          <ArrowLeft size={16} />
          Voltar à página principal
        </Link>
        <ThemeToggle />
      </div>

      {novo ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-800 dark:border-teal-900/60 dark:bg-teal-950/50 dark:text-teal-300">
          Reserva criada com sucesso!
        </div>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium text-teal-700 dark:text-teal-400">
            Reserva
            {aSincronizar ? (
              <RefreshCw
                size={12}
                className="animate-spin text-teal-400 dark:text-teal-500"
              />
            ) : null}
          </p>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${ESTADO_CLASSE[reserva.estado]}`}
          >
            {ESTADO_LABEL[reserva.estado]}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-100">
          {reserva.servicoNome}
        </h1>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500 dark:text-stone-400">Cliente</dt>
            <dd className="font-medium text-stone-800 dark:text-stone-300">
              {reserva.nomeCliente}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500 dark:text-stone-400">Data</dt>
            <dd className="font-medium capitalize text-stone-800 dark:text-stone-300">
              {formatarData(reserva.data)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500 dark:text-stone-400">Hora</dt>
            <dd className="font-medium text-stone-800 dark:text-stone-300">
              {reserva.horaInicio} – {reserva.horaFim}
            </dd>
          </div>
        </dl>

        {erro ? (
          <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-400">
            {erro}
          </p>
        ) : null}

        {ativa ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {reserva.estado === "pendente" && !reserva.confirmadoPeloCliente ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  executar(() => confirmarReservaAction(reserva.token))
                }
              >
                <Check size={16} />
                Confirmar reserva
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setAReagendar((v) => {
                  const next = !v;
                  if (next) {
                    setDate(parseDia(reserva.data));
                  }
                  return next;
                });
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
              onClick={() =>
                executar(() => cancelarReservaAction(reserva.token))
              }
            >
              <CalendarX size={16} />
              Cancelar
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
            Esta reserva já não pode ser alterada.
          </p>
        )}

        <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-800">
          <p className="mb-2 flex items-center gap-1.5 text-sm text-stone-500  dark:text-teal-300">
            <Link2 size={14} />
            Link desta reserva — guarde-o para voltar mais tarde
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              ref={linkInput}
              readOnly
              value={linkReserva}
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-xs sm:text-sm"
              aria-label="Link desta reserva"
            />
            <Button
              type="button"
              variant={copiado ? "primary" : "secondary"}
              onClick={copiarLink}
              className="shrink-0"
            >
              {copiado ? <Check size={16} /> : <Copy size={16} />}
              {copiado ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          {avisoCopia ? (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              {avisoCopia}
            </p>
          ) : null}
        </div>

        {ativa ? (
          <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-800">
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">
              Quer ser avisado sobre alterações a esta reserva?
            </p>
            <NotificacoesButton token={reserva.token} />
          </div>
        ) : null}
      </section>

      {aReagendar && ativa ? (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-5 flex items-center justify-between">
            <button
              aria-label="Dia anterior"
              onClick={() => shiftDay(-1)}
              className="rounded-md border border-stone-300 p-2 dark:border-stone-700"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Novo dia
              </p>
              <h2 className="text-lg font-semibold capitalize text-stone-950 dark:text-stone-100">
                {date.toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </h2>
            </div>
            <button
              aria-label="Dia seguinte"
              onClick={() => shiftDay(1)}
              className="rounded-md border border-stone-300 p-2 dark:border-stone-700"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {slots.length === 0 && loadingSlots ? (
            <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">
              A carregar horários…
            </p>
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">
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
                  onClick={() => setNovoSlot(slot.startsAt)}
                  title={
                    slot.blockedReason
                      ? `Indisponível: ${slot.blockedReason}`
                      : !slot.available
                        ? "Horário já reservado"
                        : undefined
                  }
                  className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition disabled:cursor-not-allowed ${
                    novoSlot === slot.startsAt
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

          <Button
            type="button"
            disabled={!novoSlot || pending}
            className="mt-5 w-full"
            onClick={() => {
              if (novoSlot) {
                executar(() =>
                  reagendarReservaAction(
                    reserva.token,
                    dateKey(date),
                    novoSlot,
                  ),
                );
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
