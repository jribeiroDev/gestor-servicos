"use client";

import { clsx } from "clsx";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Script inline (sem dependências) que corre ANTES da hidratação para evitar
 * o flash de tema errado: lê a preferência guardada ou a do sistema e aplica
 * a classe `dark` + o `color-scheme` no `<html>`. Injetar no `<head>`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('tema');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

type Variante = "botao" | "icone";

/**
 * Interruptor claro/escuro. Alterna a classe `dark` no `<html>` e persiste a
 * escolha em localStorage. Reutilizável pelas duas apps.
 */
export function ThemeToggle({
  className,
  variante = "icone",
}: {
  className?: string;
  variante?: Variante;
}) {
  const [escuro, setEscuro] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  const alternar = () => {
    const proximo = !escuro;
    setEscuro(proximo);
    const raiz = document.documentElement;
    raiz.classList.toggle("dark", proximo);
    raiz.style.colorScheme = proximo ? "dark" : "light";
    try {
      localStorage.setItem("tema", proximo ? "dark" : "light");
    } catch {
      /* localStorage indisponível — segue sem persistir */
    }
  };

  // Antes de montar mostramos o ícone de lua (estado neutro) para não divergir
  // entre servidor e cliente na hidratação.
  const Icone = montado && escuro ? Sun : Moon;
  const etiqueta = escuro ? "Mudar para tema claro" : "Mudar para tema escuro";

  if (variante === "botao") {
    return (
      <button
        type="button"
        onClick={alternar}
        aria-label={etiqueta}
        title={etiqueta}
        className={clsx(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
          className,
        )}
      >
        <Icone size={17} />
        {montado && escuro ? "Tema claro" : "Tema escuro"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      className={clsx(
        "inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 text-stone-600 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
        className,
      )}
    >
      <Icone size={17} />
    </button>
  );
}
