"use client";

import { useState } from "react";

type Pais = { code: string; nome: string; dial: string; flag: string };

// Lista curada (indicativos mais comuns para um negócio em Portugal).
const PAISES: Pais[] = [
  { code: "PT", nome: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "ES", nome: "Espanha", dial: "+34", flag: "🇪🇸" },
  { code: "FR", nome: "França", dial: "+33", flag: "🇫🇷" },
  { code: "GB", nome: "Reino Unido", dial: "+44", flag: "🇬🇧" },
  { code: "BR", nome: "Brasil", dial: "+55", flag: "🇧🇷" },
  { code: "DE", nome: "Alemanha", dial: "+49", flag: "🇩🇪" },
  { code: "CH", nome: "Suíça", dial: "+41", flag: "🇨🇭" },
  { code: "LU", nome: "Luxemburgo", dial: "+352", flag: "🇱🇺" },
  { code: "BE", nome: "Bélgica", dial: "+32", flag: "🇧🇪" },
  { code: "NL", nome: "Países Baixos", dial: "+31", flag: "🇳🇱" },
  { code: "IE", nome: "Irlanda", dial: "+353", flag: "🇮🇪" },
  { code: "IT", nome: "Itália", dial: "+39", flag: "🇮🇹" },
  { code: "US", nome: "EUA / Canadá", dial: "+1", flag: "🇺🇸" },
];

/**
 * Telefone com seletor de país (bandeira + indicativo). O cliente só escreve o
 * número; o valor emitido é "<indicativo> <numero>" (ex.: "+351 912345678").
 */
export function PhoneInput({
  onChange,
  className,
}: {
  onChange: (valor: string) => void;
  className?: string;
}) {
  const [dial, setDial] = useState("+351");
  const [numero, setNumero] = useState("");

  const emitir = (novoDial: string, novoNumero: string) => {
    const limpo = novoNumero.trim();
    onChange(limpo ? `${novoDial} ${limpo}` : "");
  };

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <select
        aria-label="Indicativo do país"
        value={dial}
        onChange={(e) => {
          setDial(e.target.value);
          emitir(e.target.value, numero);
        }}
        className="h-11 shrink-0 rounded-md border border-stone-300 bg-white px-2 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:border-teal-500 dark:focus:ring-teal-900/40"
      >
        {PAISES.map((p) => (
          <option key={p.code} value={p.dial}>
            {p.flag} {p.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={numero}
        placeholder="912 345 678"
        onChange={(e) => {
          setNumero(e.target.value);
          emitir(dial, e.target.value);
        }}
        className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-teal-500 dark:focus:ring-teal-900/40"
      />
    </div>
  );
}
