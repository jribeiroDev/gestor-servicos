"use client";

import { Button, Input, ThemeToggle } from "@gestor/ui";
import type { Servico } from "@gestor/database";
import { dateKey, generateMonthGrid, type Slot } from "@gestor/utils";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Tag,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  criarReservaAction,
  getDiasDisponiveisAction,
  getSlotsAction,
} from "./actions";
import type { MembroEquipaView } from "./lib/booking-data";
import { NotificacoesButton } from "./notificacoes-button";
import { PhoneInput } from "./phone-input";

type Passo = "profissional" | "dia" | "dados";

const DIAS_CURTO_SEG = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function formatarPreco(preco: number | null): string {
  if (preco === null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(preco);
}

function parseDia(dia: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, d ?? 1);
}

function inicioMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function BookingClient({
  servicos,
  equipa,
}: {
  servicos: Servico[];
  equipa: MembroEquipaView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Wizard
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState<Passo>("dia");
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [profissionalId, setProfissionalId] = useState<string | null>(null);

  // Calendário / horas
  const [mesCursor, setMesCursor] = useState(() => inicioMes(new Date()));
  const [diasDisponiveis, setDiasDisponiveis] = useState<string[]>([]);
  const [loadingDias, setLoadingDias] = useState(false);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotSel, setSlotSel] = useState<string | null>(null);

  // Dados
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const servico = servicos.find((s) => s.id === servicoId) ?? null;
  const membro = equipa.find((m) => m.id === profissionalId) ?? null;
  const hojeKey = dateKey(new Date());

  const abrir = (id: string) => {
    setServicoId(id);
    setProfissionalId(null);
    setMesCursor(inicioMes(new Date()));
    setDiaSel(null);
    setSlots([]);
    setSlotSel(null);
    setNome("");
    setTelefone("");
    setErro(null);
    setPasso(equipa.length > 0 ? "profissional" : "dia");
    setAberto(true);
  };

  const fechar = () => setAberto(false);

  const escolherProfissional = (id: string | null) => {
    setProfissionalId(id);
    setDiaSel(null);
    setSlots([]);
    setSlotSel(null);
    setPasso("dia");
  };

  const voltar = () => {
    if (passo === "dados") {
      setPasso("dia");
    } else if (passo === "dia" && equipa.length > 0) {
      setPasso("profissional");
    } else {
      fechar();
    }
  };

  // Dias disponíveis do mês visível.
  useEffect(() => {
    if (!aberto || !servicoId) return;
    let cancel = false;
    setLoadingDias(true);
    getDiasDisponiveisAction(
      servicoId,
      mesCursor.getFullYear(),
      mesCursor.getMonth(),
      profissionalId,
    )
      .then((d) => {
        if (!cancel) setDiasDisponiveis(d);
      })
      .catch(() => {
        if (!cancel) setDiasDisponiveis([]);
      })
      .finally(() => {
        if (!cancel) setLoadingDias(false);
      });
    return () => {
      cancel = true;
    };
  }, [aberto, servicoId, profissionalId, mesCursor]);

  // Horas do dia escolhido (apenas as disponíveis).
  useEffect(() => {
    if (!diaSel || !servicoId) {
      setSlots([]);
      return;
    }
    let cancel = false;
    setLoadingSlots(true);
    setSlotSel(null);
    getSlotsAction(servicoId, diaSel, profissionalId)
      .then((s) => {
        if (!cancel) setSlots(s.filter((x) => x.available));
      })
      .catch(() => {
        if (!cancel) setSlots([]);
      })
      .finally(() => {
        if (!cancel) setLoadingSlots(false);
      });
    return () => {
      cancel = true;
    };
  }, [diaSel, servicoId, profissionalId]);

  const grupos = useMemo(() => {
    const manha: Slot[] = [];
    const tarde: Slot[] = [];
    const noite: Slot[] = [];
    for (const s of slots) {
      if (s.startsAt < "12:00") manha.push(s);
      else if (s.startsAt < "19:00") tarde.push(s);
      else noite.push(s);
    }
    return { manha, tarde, noite };
  }, [slots]);

  const grelha = useMemo(() => generateMonthGrid(mesCursor), [mesCursor]);
  const podeRecuar = inicioMes(new Date()) < mesCursor;

  const shiftMes = (delta: number) => {
    const d = new Date(mesCursor);
    d.setMonth(d.getMonth() + delta, 1);
    setMesCursor(d);
    setDiaSel(null);
    setSlots([]);
    setSlotSel(null);
  };

  const confirmar = () => {
    if (!servicoId || !diaSel || !slotSel) return;
    setErro(null);
    startTransition(async () => {
      const r = await criarReservaAction({
        servicoId,
        dia: diaSel,
        hora: slotSel,
        nome,
        telefone,
        profissionalId,
      });
      if (r.ok) {
        router.push(`/reserva/${r.token}?novo=1`);
      } else {
        setErro(r.erro);
      }
    });
  };

  const subtitulo =
    passo === "profissional"
      ? "Escolha o profissional"
      : passo === "dia"
        ? "Escolha um dia"
        : "Os seus dados";

  if (servicos.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-5 py-10 md:px-8">
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
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-6 md:px-8">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 dark:border-stone-800 md:flex-row md:items-center md:justify-between">
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
            onClick={() => abrir(service.id)}
            className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-stone-300 hover:shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600 md:block md:p-5"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 md:mb-4 md:h-10 md:w-10">
              <Tag size={16} />
            </span>
            <div className="min-w-0 flex-1 md:block">
              <h2 className="truncate text-base font-semibold text-stone-950 dark:text-stone-100 md:text-lg">
                {service.nome}
              </h2>
              <p className="hidden text-sm leading-6 text-stone-600 dark:text-stone-400 md:mt-2 md:block md:min-h-12">
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

      {aberto && servico ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white dark:bg-stone-900 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-stone-200 sm:dark:border-stone-800">
            {/* Cabeçalho */}
            <header className="flex items-center gap-2 border-b border-stone-200 px-3 py-3 dark:border-stone-800">
              <button
                type="button"
                onClick={voltar}
                aria-label="Voltar"
                className="rounded-md p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 text-center">
                <h2 className="text-lg font-semibold text-stone-950 dark:text-stone-100">
                  Nova Marcação
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {subtitulo}
                </p>
              </div>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                <X size={20} />
              </button>
            </header>

            {/* Serviço escolhido (contexto) */}
            <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5 text-sm dark:border-stone-800">
              <Tag size={14} className="text-teal-700 dark:text-teal-400" />
              <span className="font-medium text-stone-800 dark:text-stone-200">
                {servico.nome}
              </span>
              <span className="text-stone-400 dark:text-stone-500">·</span>
              <span className="text-stone-500 dark:text-stone-400">
                {servico.duracao_minutos} min
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 ">
              {/* PASSO: PROFISSIONAL */}
              {passo === "profissional" ? (
                <div className="grid gap-2 ">
                  <button
                    type="button"
                    onClick={() => escolherProfissional(null)}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-teal-600 dark:border-stone-800 dark:bg-stone-800/40 dark:hover:border-teal-500"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-teal-900 dark:text-stone-300">
                      <Users size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-stone-900 dark:text-stone-100">
                        Sem preferência
                      </span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400">
                        Qualquer profissional disponível
                      </span>
                    </span>
                    <ChevronRight
                      size={18}
                      className="text-stone-400 dark:text-stone-500 "
                    />
                  </button>

                  {equipa.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => escolherProfissional(m.id)}
                      className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-teal-600 dark:border-stone-800 dark:bg-stone-800/40 dark:hover:border-teal-500"
                    >
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-sm font-semibold text-stone-500 dark:bg-teal-900 dark:text-stone-300 ">
                        {m.fotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.fotoUrl}
                            alt={m.nome}
                            className="h-full w-full object-cover "
                          />
                        ) : (
                          iniciais(m.nome) || <UserRound size={20} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-stone-900 dark:text-stone-100 ">
                        {m.nome}
                      </span>
                      <ChevronRight
                        size={18}
                        className="text-stone-400 dark:text-stone-500"
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              {/* PASSO: DIA + HORA */}
              {passo === "dia" ? (
                <div className="grid gap-4">
                  {membro || profissionalId === null ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <UserRound size={13} />
                      {membro ? membro.nome : "Sem preferência"}
                    </div>
                  ) : null}

                  {/* Navegação de mês */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => shiftMes(-1)}
                      disabled={!podeRecuar}
                      aria-label="Mês anterior"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-600 transition hover:bg-stone-100 disabled:opacity-30 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-base font-semibold capitalize text-stone-900 dark:text-stone-100">
                      {mesCursor.toLocaleDateString("pt-PT", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => shiftMes(1)}
                      aria-label="Mês seguinte"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-600 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Grelha mensal */}
                  <div>
                    <div className="grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
                      {DIAS_CURTO_SEG.map((d) => (
                        <div key={d} className="py-1.5">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1">
                      {grelha.map(({ date, inMonth }) => {
                        const key = dateKey(date);
                        const disponivel =
                          inMonth && diasDisponiveis.includes(key);
                        const selecionado = key === diaSel;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-center py-0.5"
                          >
                            <button
                              type="button"
                              disabled={!disponivel}
                              onClick={() => setDiaSel(key)}
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm transition ${
                                selecionado
                                  ? "bg-stone-900 font-semibold text-white dark:bg-teal-600 dark:text-white"
                                  : disponivel
                                    ? "border border-stone-200 text-stone-800 hover:border-teal-600 dark:border-stone-700 dark:text-stone-200 dark:hover:border-teal-500"
                                    : "text-stone-300 dark:text-stone-600"
                              }`}
                            >
                              {date.getDate()}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estado do mês / horas */}
                  {!loadingDias && diasDisponiveis.length === 0 ? (
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-center dark:border-stone-800 dark:bg-stone-800/40">
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
                        Não existem vagas para este mês.
                      </p>
                      <button
                        type="button"
                        onClick={() => shiftMes(1)}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-teal-700 dark:text-teal-400"
                      >
                        Ver próximo mês
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : !diaSel ? (
                    <p className="flex items-center justify-center gap-2 py-4 text-center text-sm text-stone-400 dark:text-stone-500">
                      <Calendar size={15} />
                      Escolha um dia para ver as horas.
                    </p>
                  ) : loadingSlots ? (
                    <p className="py-4 text-center text-sm text-stone-400 dark:text-stone-500">
                      A carregar horas…
                    </p>
                  ) : slots.length === 0 ? (
                    <p className="py-4 text-center text-sm text-stone-500 dark:text-stone-400">
                      Sem horas disponíveis neste dia.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <ColunaHoras
                        titulo="Manhã"
                        slots={grupos.manha}
                        selecionado={slotSel}
                        onSelecionar={setSlotSel}
                      />
                      <ColunaHoras
                        titulo="Tarde"
                        slots={grupos.tarde}
                        selecionado={slotSel}
                        onSelecionar={setSlotSel}
                      />
                      <ColunaHoras
                        titulo="Noite"
                        slots={grupos.noite}
                        selecionado={slotSel}
                        onSelecionar={setSlotSel}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {/* PASSO: DADOS */}
              {passo === "dados" ? (
                <div className="grid gap-4">
                  <div className="grid gap-1.5 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm dark:border-stone-800 dark:bg-stone-800/40">
                    <Resumo rotulo="Serviço" valor={servico.nome} />
                    <Resumo
                      rotulo="Profissional"
                      valor={membro ? membro.nome : "Sem preferência"}
                    />
                    <Resumo
                      rotulo="Dia"
                      valor={
                        diaSel
                          ? parseDia(diaSel).toLocaleDateString("pt-PT", {
                              weekday: "long",
                              day: "2-digit",
                              month: "long",
                            })
                          : ""
                      }
                    />
                    <Resumo rotulo="Hora" valor={slotSel ?? ""} />
                  </div>

                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                    Nome
                    <Input
                      className="mt-2"
                      placeholder="O seu nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                    Telemóvel
                    <PhoneInput className="mt-2" onChange={setTelefone} />
                  </label>

                  {erro ? (
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      {erro}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Rodapé */}
            {passo === "dia" ? (
              <footer className="border-t border-stone-200 p-3 dark:border-stone-800">
                <Button
                  type="button"
                  className="w-full"
                  disabled={!slotSel}
                  onClick={() => setPasso("dados")}
                >
                  Continuar
                </Button>
              </footer>
            ) : null}
            {passo === "dados" ? (
              <footer className="border-t border-stone-200 p-3 dark:border-stone-800">
                <Button
                  type="button"
                  className="w-full"
                  disabled={
                    pending || !nome.trim() || telefone.trim().length < 6
                  }
                  onClick={confirmar}
                >
                  <Check size={16} />
                  {pending ? "A confirmar…" : "Confirmar reserva"}
                </Button>
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ColunaHoras({
  titulo,
  slots,
  selecionado,
  onSelecionar,
}: {
  titulo: string;
  slots: Slot[];
  selecionado: string | null;
  onSelecionar: (hora: string) => void;
}) {
  return (
    <div className="grid content-start gap-2">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
        {titulo}
      </p>
      {slots.map((s) => (
        <button
          key={s.startsAt}
          type="button"
          onClick={() => onSelecionar(s.startsAt)}
          className={`inline-flex h-10 items-center justify-center rounded-full border text-sm font-medium transition ${
            selecionado === s.startsAt
              ? "border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600"
              : "border-stone-200 text-stone-800 hover:border-teal-600 dark:border-stone-700 dark:text-stone-200 dark:hover:border-teal-500"
          }`}
        >
          {s.startsAt}
        </button>
      ))}
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-stone-500 dark:text-stone-400">{rotulo}</span>
      <span className="text-right font-medium capitalize text-stone-900 dark:text-stone-100">
        {valor}
      </span>
    </div>
  );
}
