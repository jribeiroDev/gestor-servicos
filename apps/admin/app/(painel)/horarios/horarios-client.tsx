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

function formatarBloqueio(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const [bInicio, setBInicio] = useState("");
  const [bFim, setBFim] = useState("");
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
    if (!bInicio || !bFim) {
      setErro("Indique início e fim do bloqueio.");
      return;
    }
    executar(() =>
      criarBloqueioAction({
        dataInicio: new Date(bInicio).toISOString(),
        dataFim: new Date(bFim).toISOString(),
        motivo: bMotivo,
      }),
    );
    setBInicio("");
    setBFim("");
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
                      {formatarBloqueio(b.dataInicio)} → {formatarBloqueio(b.dataFim)}
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
            <label className="text-sm font-medium text-stone-700">
              Início
              <Input type="datetime-local" className="mt-2" value={bInicio} onChange={(e) => setBInicio(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-stone-700">
              Fim
              <Input type="datetime-local" className="mt-2" value={bFim} onChange={(e) => setBFim(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-stone-700">
              Motivo (opcional)
              <Input className="mt-2" value={bMotivo} onChange={(e) => setBMotivo(e.target.value)} placeholder="Ex.: Férias" />
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
