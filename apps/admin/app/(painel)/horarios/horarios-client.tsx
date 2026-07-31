"use client";

import { Button, Checkbox, Input } from "@gestor/ui";
import { CalendarOff, Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  apagarBloqueioAction,
  apagarHorariosDiaAction,
  criarBloqueioAction,
  guardarHorariosDiaAction,
} from "../../actions";

type HorarioView = {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  profissionalId: string | null;
};
type BloqueioView = {
  id: string;
  dataInicio: string;
  dataFim: string;
  motivo: string | null;
  profissionalId: string | null;
};
type MembroView = { id: string; nome: string };

type Janela = { horaInicio: string; horaFim: string };
type Grupo = { diaSemana: number; profissionalId: string | null; janelas: Janela[] };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
// Ordem de apresentação: começa à segunda, sábado e domingo no fim.
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

const APENAS_DATA = /^\d{4}-\d{2}-\d{2}$/;

const pad = (valor: number) => valor.toString().padStart(2, "0");
const chaveData = (data: Date) =>
  `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;

/** Aceita ISO completo ou data simples (que representa o dia inteiro). */
function parseLimite(valor: string): { data: Date; apenasData: boolean } {
  if (APENAS_DATA.test(valor)) {
    const [ano, mes, dia] = valor.split("-").map(Number);
    return { data: new Date(ano, mes - 1, dia), apenasData: true };
  }
  return { data: new Date(valor), apenasData: false };
}

function formatarBloqueio(inicioIso: string, fimIso: string): string {
  const inicio = parseLimite(inicioIso);
  const fim = parseLimite(fimIso);
  const dia = (data: Date) => data.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  const hora = (data: Date) => data.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  const mesmoDia = chaveData(inicio.data) === chaveData(fim.data);
  const diaInteiro =
    inicio.apenasData ||
    fim.apenasData ||
    (inicio.data.getHours() === 0 && inicio.data.getMinutes() === 0 && fim.data.getHours() >= 23);

  if (diaInteiro) {
    return mesmoDia ? `${dia(inicio.data)} · dia inteiro` : `${dia(inicio.data)} → ${dia(fim.data)} · dias inteiros`;
  }
  return mesmoDia
    ? `${dia(inicio.data)} · ${hora(inicio.data)}–${hora(fim.data)}`
    : `${dia(inicio.data)} ${hora(inicio.data)} → ${dia(fim.data)} ${hora(fim.data)}`;
}

/** Agrupa as janelas por (dia, profissional), ordenadas por hora. */
function agruparHorarios(horarios: HorarioView[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const h of horarios) {
    const chave = `${h.diaSemana}|${h.profissionalId ?? ""}`;
    const grupo = mapa.get(chave);
    const janela = { horaInicio: h.horaInicio, horaFim: h.horaFim };
    if (grupo) {
      grupo.janelas.push(janela);
    } else {
      mapa.set(chave, { diaSemana: h.diaSemana, profissionalId: h.profissionalId, janelas: [janela] });
    }
  }
  const grupos = [...mapa.values()];
  for (const g of grupos) {
    g.janelas.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }
  grupos.sort((a, b) => {
    const da = ORDEM_DIAS.indexOf(a.diaSemana) - ORDEM_DIAS.indexOf(b.diaSemana);
    if (da !== 0) return da;
    // Geral (null) primeiro, depois por profissional.
    return (a.profissionalId ?? "").localeCompare(b.profissionalId ?? "");
  });
  return grupos;
}

export function HorariosClient({
  horarios,
  bloqueios,
  equipa,
}: {
  horarios: HorarioView[];
  bloqueios: BloqueioView[];
  equipa: MembroView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Diálogo de edição de horário.
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [original, setOriginal] = useState<{ diaSemana: number; profissionalId: string | null } | null>(null);
  const [dDiaSemana, setDDiaSemana] = useState(1);
  const [dProfissionalId, setDProfissionalId] = useState<string>("");
  const [dJanelas, setDJanelas] = useState<Janela[]>([{ horaInicio: "09:00", horaFim: "18:00" }]);

  // Bloqueios.
  const hojeKey = chaveData(new Date());
  const [bDataInicio, setBDataInicio] = useState(hojeKey);
  const [bDataFim, setBDataFim] = useState(hojeKey);
  const [bHoraInicio, setBHoraInicio] = useState("09:00");
  const [bHoraFim, setBHoraFim] = useState("18:00");
  const [bDiaInteiro, setBDiaInteiro] = useState(true);
  const [bMotivo, setBMotivo] = useState("");
  const [bProfissionalId, setBProfissionalId] = useState<string>("");

  const grupos = agruparHorarios(horarios);

  const nomeProfissional = (id: string | null) =>
    id ? (equipa.find((m) => m.id === id)?.nome ?? "Profissional") : "Geral (todos)";

  const executar = (accao: () => Promise<{ ok: boolean; erro?: string }>, aoConcluir?: () => void) => {
    setErro(null);
    startTransition(async () => {
      const resultado = await accao();
      if (resultado.ok) {
        aoConcluir?.();
        router.refresh();
      } else {
        setErro(resultado.erro ?? "Ocorreu um erro.");
      }
    });
  };

  /* -------------------------------------------------- Diálogo de horário */

  const abrirNovo = () => {
    setErro(null);
    setOriginal(null);
    setDDiaSemana(1);
    setDProfissionalId("");
    setDJanelas([{ horaInicio: "09:00", horaFim: "18:00" }]);
    setDialogoAberto(true);
  };

  const abrirEdicao = (grupo: Grupo) => {
    setErro(null);
    setOriginal({ diaSemana: grupo.diaSemana, profissionalId: grupo.profissionalId });
    setDDiaSemana(grupo.diaSemana);
    setDProfissionalId(grupo.profissionalId ?? "");
    setDJanelas(grupo.janelas.map((j) => ({ ...j })));
    setDialogoAberto(true);
  };

  const fecharDialogo = () => setDialogoAberto(false);

  const alterarJanela = (indice: number, campo: keyof Janela, valor: string) => {
    setDJanelas((atual) => atual.map((j, i) => (i === indice ? { ...j, [campo]: valor } : j)));
  };
  const adicionarJanela = () => {
    setDJanelas((atual) => {
      const ultima = atual[atual.length - 1];
      const inicio = ultima ? ultima.horaFim : "09:00";
      return [...atual, { horaInicio: inicio, horaFim: inicio < "18:00" ? "18:00" : inicio }];
    });
  };
  const removerJanela = (indice: number) => {
    setDJanelas((atual) => (atual.length > 1 ? atual.filter((_, i) => i !== indice) : atual));
  };

  const guardarHorario = () => {
    setErro(null);
    executar(
      () =>
        guardarHorariosDiaAction({
          original,
          diaSemana: dDiaSemana,
          profissionalId: dProfissionalId || null,
          janelas: dJanelas,
        }),
      () => setDialogoAberto(false),
    );
  };

  /* ------------------------------------------------------------ Bloqueios */

  const adicionarBloqueio = () => {
    setErro(null);
    if (!bDataInicio || !bDataFim) {
      setErro("Indique as datas do bloqueio.");
      return;
    }
    const inicio = new Date(`${bDataInicio}T${bDiaInteiro ? "00:00" : bHoraInicio}:00`);
    const fim = new Date(`${bDataFim}T${bDiaInteiro ? "23:59" : bHoraFim}:00`);

    if (fim <= inicio) {
      setErro("O fim do bloqueio tem de ser depois do início.");
      return;
    }
    const inicioDeHoje = new Date();
    inicioDeHoje.setHours(0, 0, 0, 0);
    if (inicio < inicioDeHoje) {
      setErro("Não é possível criar bloqueios em datas passadas.");
      return;
    }

    executar(
      () =>
        criarBloqueioAction({
          dataInicio: inicio.toISOString(),
          dataFim: fim.toISOString(),
          motivo: bMotivo,
          profissionalId: bProfissionalId || null,
        }),
      () => setBMotivo(""),
    );
  };

  return (
    <section className="lg:min-h-screen">
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-5 py-5">
        <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">Horários e bloqueios</h2>
      </header>

      {erro && !dialogoAberto ? (
        <p className="px-5 pt-4 text-sm font-medium text-red-700 dark:text-red-400">{erro}</p>
      ) : null}

      <div className="grid gap-6 p-5 xl:grid-cols-2">
        {/* Horários de funcionamento */}
        <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-stone-950 dark:text-stone-100">
              <Clock size={17} />
              Horário de funcionamento
            </h3>
            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stone-950 text-white transition hover:bg-stone-800 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200"
              aria-label="Adicionar horário"
              title="Adicionar horário"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {grupos.length === 0 ? (
              <p className="rounded-md border border-dashed border-stone-300 px-3 py-6 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
                Sem horários definidos. Use o botão + para adicionar.
              </p>
            ) : (
              grupos.map((grupo) => (
                <button
                  key={`${grupo.diaSemana}|${grupo.profissionalId ?? ""}`}
                  type="button"
                  onClick={() => abrirEdicao(grupo)}
                  className="group flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2.5 text-left text-sm transition hover:border-stone-300 hover:bg-stone-50 dark:border-stone-800 dark:hover:border-stone-700 dark:hover:bg-stone-800/50"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-stone-800 dark:text-stone-200">
                        {DIAS[grupo.diaSemana]}
                      </span>
                      {equipa.length > 0 ? (
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                          {nomeProfissional(grupo.profissionalId)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-stone-500 dark:text-stone-400">
                      {grupo.janelas.map((j) => `${j.horaInicio}–${j.horaFim}`).join(" · ")}
                    </span>
                  </span>
                  <Pencil
                    size={15}
                    className="shrink-0 text-stone-400 transition group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300"
                  />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Bloqueios */}
        <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-stone-950 dark:text-stone-100">
            <CalendarOff size={17} />
            Bloqueios de calendário
          </h3>

          <div className="mt-4 grid gap-2">
            {bloqueios.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">Sem bloqueios futuros.</p>
            ) : (
              bloqueios.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-md border border-stone-200 dark:border-stone-800 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-stone-800 dark:text-stone-300">
                      {formatarBloqueio(b.dataInicio, b.dataFim)}
                    </span>
                    {equipa.length > 0 ? (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                        {nomeProfissional(b.profissionalId)}
                      </span>
                    ) : null}
                    {b.motivo ? <span className="text-stone-500 dark:text-stone-400"> · {b.motivo}</span> : null}
                  </span>
                  <button
                    onClick={() => executar(() => apagarBloqueioAction(b.id))}
                    disabled={pending}
                    aria-label="Remover"
                    className="rounded-md p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-3 border-t border-stone-200 dark:border-stone-800 pt-4">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Novo bloqueio</p>

            {equipa.length > 0 ? (
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Profissional
                <select
                  value={bProfissionalId}
                  onChange={(e) => setBProfissionalId(e.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                >
                  <option value="">Todos (negócio fechado)</option>
                  {equipa.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
              <Checkbox checked={bDiaInteiro} onChange={(e) => setBDiaInteiro(e.target.checked)} />
              Dia(s) inteiro(s)
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                De
                <Input
                  type="date"
                  min={hojeKey}
                  className="mt-1.5"
                  value={bDataInicio}
                  onChange={(e) => {
                    setBDataInicio(e.target.value);
                    if (e.target.value && bDataFim < e.target.value) {
                      setBDataFim(e.target.value);
                    }
                  }}
                />
                {!bDiaInteiro ? (
                  <Input
                    type="time"
                    className="mt-1.5"
                    value={bHoraInicio}
                    onChange={(e) => setBHoraInicio(e.target.value)}
                  />
                ) : null}
              </label>

              <label className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Até
                <Input
                  type="date"
                  min={bDataInicio || hojeKey}
                  className="mt-1.5"
                  value={bDataFim}
                  onChange={(e) => setBDataFim(e.target.value)}
                />
                {!bDiaInteiro ? (
                  <Input
                    type="time"
                    className="mt-1.5"
                    value={bHoraFim}
                    onChange={(e) => setBHoraFim(e.target.value)}
                  />
                ) : null}
              </label>
            </div>

            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Motivo (visível ao cliente)
              <Input
                className="mt-2"
                value={bMotivo}
                onChange={(e) => setBMotivo(e.target.value)}
                placeholder="Ex.: Férias, Formação, Almoço"
              />
            </label>

            <Button type="button" disabled={pending} onClick={adicionarBloqueio}>
              <Plus size={16} />
              Adicionar bloqueio
            </Button>
          </div>
        </div>
      </div>

      {/* Diálogo: adicionar / editar horário */}
      {dialogoAberto ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-white dark:bg-stone-900 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-stone-200 sm:dark:border-stone-800">
            <header className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
              <h3 className="text-base font-semibold text-stone-950 dark:text-stone-100">
                {original ? "Editar horário" : "Novo horário"}
              </h3>
              <button
                type="button"
                onClick={fecharDialogo}
                aria-label="Fechar"
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-4">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  Dia
                  <select
                    value={dDiaSemana}
                    onChange={(e) => setDDiaSemana(Number(e.target.value))}
                    className="mt-2 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                  >
                    {ORDEM_DIAS.map((indice) => (
                      <option key={indice} value={indice}>
                        {DIAS[indice]}
                      </option>
                    ))}
                  </select>
                </label>

                {equipa.length > 0 ? (
                  <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    Profissional
                    <select
                      value={dProfissionalId}
                      onChange={(e) => setDProfissionalId(e.target.value)}
                      className="mt-2 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                    >
                      <option value="">Geral (todos)</option>
                      {equipa.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Janelas de horário</p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    Adicione mais do que uma para incluir a pausa de almoço.
                  </p>
                  <div className="mt-2 grid gap-2">
                    {dJanelas.map((janela, indice) => (
                      <div key={indice} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={janela.horaInicio}
                          onChange={(e) => alterarJanela(indice, "horaInicio", e.target.value)}
                        />
                        <span className="text-stone-400 dark:text-stone-500">–</span>
                        <Input
                          type="time"
                          value={janela.horaFim}
                          onChange={(e) => alterarJanela(indice, "horaFim", e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removerJanela(indice)}
                          disabled={dJanelas.length === 1}
                          aria-label="Remover janela"
                          className="shrink-0 rounded-md p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-30 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={adicionarJanela}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 transition hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
                  >
                    <Plus size={15} />
                    Adicionar janela
                  </button>
                </div>

                {erro ? <p className="text-sm font-medium text-red-700 dark:text-red-400">{erro}</p> : null}
              </div>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-stone-200 p-3 dark:border-stone-800">
              {original ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() =>
                    executar(
                      () => apagarHorariosDiaAction(original.diaSemana, original.profissionalId),
                      () => setDialogoAberto(false),
                    )
                  }
                >
                  <Trash2 size={16} />
                  Remover
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" disabled={pending} onClick={guardarHorario}>
                {pending ? "A guardar…" : "Guardar"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
