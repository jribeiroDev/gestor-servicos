"use client";

import { Button, Input } from "@gestor/ui";
import type { Servico } from "@gestor/database";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  alternarServicoAtivoAction,
  apagarServicoAction,
  atualizarServicoAction,
  criarServicoAction,
} from "../../actions";

type FormState = {
  nome: string;
  descricao: string;
  duracaoMinutos: string;
  preco: string;
  ativo: boolean;
};

const FORM_VAZIO: FormState = {
  nome: "",
  descricao: "",
  duracaoMinutos: "30",
  preco: "",
  ativo: true,
};

function formatarPreco(preco: number | null): string {
  if (preco === null) return "—";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(preco);
}

export function ServicosClient({ servicos }: { servicos: Servico[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aEditar, setAEditar] = useState<string | "novo" | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);

  const abrirNovo = () => {
    setErro(null);
    setForm(FORM_VAZIO);
    setAEditar("novo");
  };

  const abrirEdicao = (servico: Servico) => {
    setErro(null);
    setForm({
      nome: servico.nome,
      descricao: servico.descricao ?? "",
      duracaoMinutos: String(servico.duracao_minutos),
      preco: servico.preco === null ? "" : String(servico.preco),
      ativo: servico.ativo,
    });
    setAEditar(servico.id);
  };

  const fechar = () => {
    setAEditar(null);
    setErro(null);
  };

  const executar = (accao: () => Promise<{ ok: boolean; erro?: string }>, fecharApos = false) => {
    setErro(null);
    startTransition(async () => {
      const resultado = await accao();
      if (resultado.ok) {
        if (fecharApos) setAEditar(null);
        router.refresh();
      } else {
        setErro(resultado.erro ?? "Ocorreu um erro.");
      }
    });
  };

  const submeter = () => {
    const dados = {
      nome: form.nome,
      descricao: form.descricao,
      duracaoMinutos: Number(form.duracaoMinutos),
      preco: form.preco.trim() === "" ? null : Number(form.preco.replace(",", ".")),
      ativo: form.ativo,
    };
    if (aEditar === "novo") {
      executar(() => criarServicoAction(dados), true);
    } else if (aEditar) {
      const id = aEditar;
      executar(() => atualizarServicoAction(id, dados), true);
    }
  };

  return (
    <section className="lg:min-h-screen">
      <header className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-5 py-5">
        <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">Serviços</h2>
        <Button type="button" onClick={abrirNovo}>
          <Plus size={16} />
          Novo serviço
        </Button>
      </header>

      <div className="grid gap-5 p-5">
        {aEditar ? (
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-stone-950 dark:text-stone-100">
                {aEditar === "novo" ? "Novo serviço" : "Editar serviço"}
              </h3>
              <button onClick={fechar} aria-label="Fechar" className="rounded-md p-1 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300 md:col-span-2">
                Nome
                <Input
                  className="mt-2"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Consulta inicial"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300 md:col-span-2">
                Descrição
                <Input
                  className="mt-2"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Breve descrição do serviço"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Duração (min)
                <Input
                  className="mt-2"
                  type="number"
                  min={1}
                  value={form.duracaoMinutos}
                  onChange={(e) => setForm({ ...form, duracaoMinutos: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Preço (€)
                <Input
                  className="mt-2"
                  inputMode="decimal"
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: e.target.value })}
                  placeholder="Opcional"
                />
              </label>
              <label className="flex items-center gap-2 self-end text-sm font-medium text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="h-4 w-4 rounded border-stone-300 dark:border-stone-600 dark:bg-stone-900"
                />
                Ativo
              </label>
            </div>
            {erro ? <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-400">{erro}</p> : null}
            <div className="mt-5 flex gap-2">
              <Button type="button" disabled={pending} onClick={submeter}>
                <Check size={16} />
                Guardar
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={fechar}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {erro && !aEditar ? <p className="text-sm font-medium text-red-700 dark:text-red-400">{erro}</p> : null}

        <div className="grid gap-3">
          {servicos.length === 0 ? (
            <p className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-stone-600 dark:text-stone-400">
              Ainda não há serviços. Crie o primeiro.
            </p>
          ) : (
            servicos.map((servico) => (
              <div
                key={servico.id}
                className="flex flex-col gap-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-950 dark:text-stone-100">{servico.nome}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        servico.ativo ? "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300" : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
                      }`}
                    >
                      {servico.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {servico.duracao_minutos} min · {formatarPreco(servico.preco)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => executar(() => alternarServicoAtivoAction(servico.id, !servico.ativo))}
                  >
                    {servico.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => abrirEdicao(servico)}>
                    <Pencil size={15} />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Apagar o serviço "${servico.nome}"?`)) {
                        executar(() => apagarServicoAction(servico.id));
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
