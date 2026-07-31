"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import {
  associarSubscricaoTokenAction,
  guardarSubscricaoAction,
  removerSubscricaoAction,
} from "./actions";

type Estado =
  | "indisponivel"
  | "sem-config"
  | "inativo"
  | "a-processar"
  | "ativo"
  | "bloqueado"
  | "erro";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

const suportado = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function NotificacoesButton({ token }: { token?: string }) {
  const [estado, setEstado] = useState<Estado>("inativo");
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

  // Reflete o estado real: existe subscrição ativa neste browser?
  useEffect(() => {
    if (!suportado()) {
      setEstado("indisponivel");
      return;
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setEstado("sem-config");
      return;
    }
    let cancelado = false;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscricao = await registration.pushManager.getSubscription();
        if (!cancelado) {
          if (subscricao) setEstado("ativo");
          else if (Notification.permission === "denied") setEstado("bloqueado");
          else setEstado("inativo");
        }
        // Garante que uma subscrição já existente fica ligada a ESTA reserva,
        // senão os avisos de mudança de estado nunca a encontram.
        if (subscricao && token) {
          await associarSubscricaoTokenAction(subscricao.endpoint, token);
        }
      } catch {
        if (!cancelado) setEstado("inativo");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  const ativar = async () => {
    setEstado("a-processar");
    setDetalheErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        if (permissao === "denied") {
          setEstado("bloqueado");
          setDetalheErro(null);
        } else {
          setEstado("inativo");
        }
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existente = await registration.pushManager.getSubscription();
      const subscricao =
        existente ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
        }));
      const json = subscricao.toJSON();
      const resultado = await guardarSubscricaoAction(
        { endpoint: json.endpoint ?? "", keys: json.keys ?? {} },
        token,
      );
      if (resultado.ok) {
        setEstado("ativo");
      } else {
        setEstado("erro");
        setDetalheErro(resultado.erro ?? null);
      }
    } catch (erro) {
      console.error("[push] ativar falhou:", erro);
      setEstado("erro");
      setDetalheErro(erro instanceof Error ? erro.message : String(erro));
    }
  };

  const desativar = async () => {
    setEstado("a-processar");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscricao = await registration.pushManager.getSubscription();
      const endpoint = subscricao?.endpoint;
      if (subscricao) {
        await subscricao.unsubscribe();
      }
      if (endpoint) {
        await removerSubscricaoAction(endpoint);
      }
      setEstado("inativo");
    } catch {
      setEstado("erro");
    }
  };

  const clicar = () => {
    if (estado === "ativo") {
      void desativar();
    } else if (estado === "inativo" || estado === "erro") {
      void ativar();
    }
  };

  const rotulo: Record<Estado, string> = {
    indisponivel: "Notificações indisponíveis",
    "sem-config": "Notificações não configuradas",
    inativo: "Ativar notificações",
    "a-processar": "Um momento…",
    ativo: "Desativar notificações",
    bloqueado: "Notificações bloqueadas",
    erro: "Tentar novamente",
  };

  const desativado =
    estado === "indisponivel" ||
    estado === "sem-config" ||
    estado === "a-processar" ||
    estado === "bloqueado";

  const Icone = estado === "ativo" ? BellRing : estado === "inativo" ? Bell : BellOff;

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={clicar}
        disabled={desativado}
        className={`inline-flex h-10 items-center gap-2 self-start rounded-md border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
          estado === "ativo"
            ? "border-teal-700 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/40"
            : "border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        }`}
      >
        <Icone size={16} />
        {rotulo[estado]}
      </button>
      {estado === "erro" ? (
        <span className="text-xs text-red-600 dark:text-red-400">
          {detalheErro ?? "Não foi possível concluir. Verifique as permissões do browser."}
        </span>
      ) : null}
      {estado === "bloqueado" ? (
        <span className="text-xs text-amber-700 dark:text-amber-400">
          Notificações bloqueadas para este site. Reative-as nas definições do browser (ícone de cadeado →
          Notificações → Permitir).
        </span>
      ) : null}
      {estado === "sem-config" ? (
        <span className="text-xs text-stone-500 dark:text-stone-400">O envio de push ainda não está configurado no servidor.</span>
      ) : null}
    </div>
  );
}
