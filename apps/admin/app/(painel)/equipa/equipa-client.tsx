"use client";

import { Button, Input } from "@gestor/ui";
import { Plus, Trash2, UploadCloud, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { apagarMembroEquipaAction, criarMembroEquipaAction } from "../../actions";
import type { EquipaView } from "../../../lib/admin-data";

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function EquipaClient({ equipa }: { equipa: EquipaView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const escolherFicheiro = (file: File | null) => {
    setFicheiro(file);
    setPreviewUrl((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const limpar = () => {
    setNome("");
    escolherFicheiro(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const adicionar = () => {
    setErro(null);
    if (nome.trim().length < 2) {
      setErro("Indique o nome do membro.");
      return;
    }
    const fd = new FormData();
    fd.append("nome", nome.trim());
    if (ficheiro) fd.append("foto", ficheiro);
    startTransition(async () => {
      const resultado = await criarMembroEquipaAction(fd);
      if (resultado.ok) {
        limpar();
        router.refresh();
      } else {
        setErro(resultado.erro ?? "Ocorreu um erro.");
      }
    });
  };

  const remover = (id: string, nomeMembro: string) => {
    if (!confirm(`Remover "${nomeMembro}" da equipa?`)) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await apagarMembroEquipaAction(id);
      if (resultado.ok) {
        router.refresh();
      } else {
        setErro(resultado.erro ?? "Ocorreu um erro.");
      }
    });
  };

  return (
    <section className="lg:min-h-screen">
      <header className="border-b border-stone-200 bg-white px-5 py-5 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">Equipa</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {equipa.length} membro(s) · adicione com nome e foto
        </p>
      </header>

      <div className="grid gap-6 p-5 xl:grid-cols-[360px_1fr]">
        {/* Adicionar membro */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="font-semibold text-stone-950 dark:text-stone-100">Novo membro</h3>

          <div className="mt-4 flex items-center gap-4">
            <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Pré-visualização" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={26} />
              )}
            </span>
            <div className="grid gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => escolherFicheiro(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
                <UploadCloud size={16} />
                {ficheiro ? "Trocar foto" : "Escolher foto"}
              </Button>
              {ficheiro ? (
                <span className="truncate text-xs text-stone-500 dark:text-stone-400">{ficheiro.name}</span>
              ) : (
                <span className="text-xs text-stone-400 dark:text-stone-500">Opcional · máx. 5 MB</span>
              )}
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Nome
            <Input
              className="mt-2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ana Silva"
            />
          </label>

          {erro ? <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-400">{erro}</p> : null}

          <div className="mt-5 flex gap-2">
            <Button type="button" disabled={pending} onClick={adicionar}>
              <Plus size={16} />
              {pending ? "A adicionar…" : "Adicionar"}
            </Button>
          </div>
        </div>

        {/* Lista da equipa */}
        <div>
          {equipa.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
              Ainda não há membros na equipa.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {equipa.map((membro) => (
                <li
                  key={membro.id}
                  className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-sm font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-300">
                    {membro.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={membro.fotoUrl} alt={membro.nome} className="h-full w-full object-cover" />
                    ) : (
                      iniciais(membro.nome) || <UserRound size={20} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-stone-900 dark:text-stone-100">
                    {membro.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => remover(membro.id, membro.nome)}
                    disabled={pending}
                    aria-label={`Remover ${membro.nome}`}
                    className="rounded-md p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
