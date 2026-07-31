"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { guardarSubscricaoAdminAction, removerSubscricaoAdminAction } from "../../actions";

type Estado = "indisponivel" | "sem-config" | "inativo" | "a-processar" | "ativo" | "erro";

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

/** Regista ESTE dispositivo do negócio para receber avisos de reservas. */
export function NotificacoesAdminButton() {
  const [estado, setEstado] = useState<Estado>("inativo");
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

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
        if (!cancelado) setEstado(subscricao ? "ativo" : "inativo");
      } catch {
        if (!cancelado) setEstado("inativo");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const ativar = async () => {
    setEstado("a-processar");
    setDetalheErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado("inativo");
        setDetalheErro(
          permissao === "denied" ? "Permissão de notificações bloqueada nas definições do browser." : null,
        );
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
      const resultado = await guardarSubscricaoAdminAction({
        endpoint: json.endpoint ?? "",
        keys: json.keys ?? {},
      });
      if (resultado.ok) {
        setEstado("ativo");
      } else {
        setEstado("erro");
        setDetalheErro(resultado.erro ?? null);
      }
    } catch (erro) {
      console.error("[push admin] ativar falhou:", erro);
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
      if (subscricao) await subscricao.unsubscribe();
      if (endpoint) await removerSubscricaoAdminAction(endpoint);
      setEstado("inativo");
    } catch {
      setEstado("erro");
    }
  };

  const clicar = () => {
    if (estado === "ativo") void desativar();
    else if (estado === "inativo" || estado === "erro") void ativar();
  };

  const rotulo: Record<Estado, string> = {
    indisponivel: "Não suportado neste dispositivo",
    "sem-config": "Push não configurado no servidor",
    inativo: "Ativar avisos neste dispositivo",
    "a-processar": "Um momento…",
    ativo: "Avisos ativos — desativar",
    erro: "Tentar novamente",
  };

  const desativado = estado === "indisponivel" || estado === "sem-config" || estado === "a-processar";
  const Icone = estado === "ativo" ? BellRing : estado === "inativo" ? Bell : BellOff;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-stone-900 dark:text-stone-100">Receber avisos neste dispositivo</span>
        <span className="text-sm text-stone-500 dark:text-stone-400">
          Ative em cada telemóvel/computador onde quer ser avisado de reservas novas e alterações dos clientes.
        </span>
      </div>
      <button
        type="button"
        onClick={clicar}
        disabled={desativado}
        className={`mt-3 inline-flex h-10 items-center gap-2 self-start rounded-md border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
          estado === "ativo"
            ? "border-teal-700 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/40"
            : "border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        }`}
      >
        <Icone size={16} />
        {rotulo[estado]}
      </button>
      {estado === "erro" ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {detalheErro ?? "Não foi possível concluir. Verifique as permissões do browser."}
        </p>
      ) : null}
      {estado === "sem-config" ? (
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Falta a chave VAPID pública no ambiente do painel.</p>
      ) : null}
    </div>
  );
}
