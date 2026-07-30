"use client";

import { Button, Input } from "@gestor/ui";
import { CalendarOff, Clock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  apagarBloqueioAction,
  apagarHorarioAction,
  criarBloqueioAction,
  criarHorarioAction,
} from "../../actions";

type HorarioView = { id: string; diaSemana: number; horaInicio: string; horaFim: string };
type BloqueioView = { id: string; dataInicio: string; dataFim: string; motivo: string | null };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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
  // Sem hora na BD (coluna `date`) ou a cobrir o dia todo.
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

export function HorariosClient({
  horarios,
  bloqueios,
}: {
  horarios: HorarioView[];
  bloqueios: BloqueioView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [diaSemana, setDiaSemana] = useState(1);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("18:00");

  const hojeKey = chaveData(new Date());
  const [bDataInicio, setBDataInicio] = useState(hojeKey);
  const [bDataFim, setBDataFim] = useState(hojeKey);
  const [bHoraInicio, setBHoraInicio] = useState("09:00");
  const [bHoraFim, setBHoraFim] = useState("18:00");
  const [bDiaInteiro, setBDiaInteiro] = useState(true);
  const [bMotivo, setBMotivo] = useState("");

  const executar = (accao: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null);
    startTransition(async () => {
      const resultado = await accao();
      if (resultado.ok) {
        router.refresh();
      } else {
        setErro(resultado.erro ?? "Ocorreu um erro.");
      }
    });
  };

  const adicionarHorario = () =>
    executar(() => criarHorarioAction({ diaSemana, horaInicio, horaFim }));

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

    executar(() =>
      criarBloqueioAction({
        dataInicio: inicio.toISOString(),
        dataFim: fim.toISOString(),
        motivo: bMotivo,
      }),
    );
    setBMotivo("");
  };

  return (
    <section className="lg:min-h-screen">
      <header className="border-b border-stone-200 bg-white px-5 py-5">
        <h2 className="text-2xl font-semibold text-stone-950">Horários e bloqueios</h2>
      </header>

      {erro ? <p className="px-5 pt-4 text-sm font-medium text-red-700">{erro}</p> : null}

      <div className="grid gap-6 p-5 xl:grid-cols-2">
        {/* Horários de funcionamento */}
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-semibold text-stone-950">
            <Clock size={17} />
            Horário de funcionamento
          </h3>

          <div className="mt-4 grid gap-2">
            {horarios.length === 0 ? (
              <p className="text-sm text-stone-500">Sem janelas definidas.</p>
            ) : (
              horarios.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-stone-800">{DIAS[h.diaSemana]}</span>
                    <span className="text-stone-500">
                      {" "}
                      · {h.horaInicio}–{h.horaFim}
                    </span>
                  </span>
                  <button
                    onClick={() => executar(() => apagarHorarioAction(h.id))}
                    disabled={pending}
                    aria-label="Remover"
                    className="rounded-md p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <label className="text-sm font-medium text-stone-700">
              Dia
              <select
                value={diaSemana}
                onChange={(e) => setDiaSemana(Number(e.target.value))}
                className="mt-2 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              >
                {DIAS.map((dia, index) => (
                  <option key={dia} value={index}>
                    {dia}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-stone-700">
              Início
              <Input type="time" className="mt-2" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-stone-700">
              Fim
              <Input type="time" className="mt-2" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </label>
            <Button type="button" disabled={pending} onClick={adicionarHorario}>
              <Plus size={16} />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Bloqueios */}
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-semibold text-stone-950">
            <CalendarOff size={17} />
            Bloqueios de calendário
          </h3>

          <div className="mt-4 grid gap-2">
            {bloqueios.length === 0 ? (
              <p className="text-sm text-stone-500">Sem bloqueios futuros.</p>
            ) : (
              bloqueios.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-stone-800">
                      {formatarBloqueio(b.dataInicio, b.dataFim)}
                    </span>
                    {b.motivo ? <span className="text-stone-500"> · {b.motivo}</span> : null}
                  </span>
                  <button
                    onClick={() => executar(() => apagarBloqueioAction(b.id))}
                    disabled={pending}
                    aria-label="Remover"
                    className="rounded-md p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4">
            <p className="text-sm font-medium text-stone-700">Novo bloqueio</p>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={bDiaInteiro}
                onChange={(e) => setBDiaInteiro(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300"
              />
              Dia(s) inteiro(s)
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                De
                <Input
                  type="date"
                  min={hojeKey}
                  className="mt-1.5"
                  value={bDataInicio}
                  onChange={(e) => {
                    setBDataInicio(e.target.value);
                    // Mantém o fim coerente com o início.
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

              <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
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

            <label className="text-sm font-medium text-stone-700">
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
    </section>
  );
}
