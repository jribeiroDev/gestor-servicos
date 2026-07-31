"use client";

import { Button, Input } from "@gestor/ui";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aSubmeter, setASubmeter] = useState(false);

  const submeter = async (event: FormEvent) => {
    event.preventDefault();
    setErro(null);
    setASubmeter(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErro("Credenciais inválidas.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErro("Não foi possível iniciar sessão.");
    } finally {
      setASubmeter(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submeter} className="w-full max-w-sm rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-400">
          <Lock size={15} />
          Painel protegido
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-950 dark:text-stone-100">Entrar</h1>
        <label className="mt-6 block text-sm font-medium text-stone-700 dark:text-stone-300">
          Email
          <Input
            type="email"
            autoComplete="email"
            className="mt-2"
            placeholder="admin@exemplo.pt"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-700 dark:text-stone-300">
          Palavra-passe
          <Input
            type="password"
            autoComplete="current-password"
            className="mt-2"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {erro ? <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-400">{erro}</p> : null}
        <Button type="submit" disabled={aSubmeter} className="mt-6 w-full">
          {aSubmeter ? "A entrar…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
