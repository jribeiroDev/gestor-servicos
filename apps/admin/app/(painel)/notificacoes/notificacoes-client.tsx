"use client";

import { Button, Input } from "@gestor/ui";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarConfigNotificacaoAction } from "../../actions";
import { NotificacoesAdminButton } from "./notificacoes-admin-button";

type ConfigView = {
  webPush: boolean;
  email: boolean;
  emailDestino: string;
  whatsapp: boolean;
  whatsappNumero: string;
  sms: boolean;
  smsNumero: string;
};

export function NotificacoesClient({ config }: { config: ConfigView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState<ConfigView>(config);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const set = <K extends keyof ConfigView>(chave: K, valor: ConfigView[K]) =>
    setEstado((atual) => ({ ...atual, [chave]: valor }));

  const guardar = () => {
    setMsg(null);
    if (estado.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(estado.emailDestino.trim())) {
      setMsg({ tipo: "erro", texto: "Indique um email válido para o canal Email." });
      return;
    }
    if (estado.whatsapp && estado.whatsappNumero.trim().length < 6) {
      setMsg({ tipo: "erro", texto: "Indique um número de WhatsApp válido." });
      return;
    }
    if (estado.sms && estado.smsNumero.trim().length < 6) {
      setMsg({ tipo: "erro", texto: "Indique um número de SMS válido." });
      return;
    }

    startTransition(async () => {
      const resultado = await guardarConfigNotificacaoAction({
        web_push_ativo: estado.webPush,
        email_ativo: estado.email,
        email_destino: estado.emailDestino.trim() || null,
        whatsapp_ativo: estado.whatsapp,
        whatsapp_numero: estado.whatsappNumero.trim() || null,
        sms_ativo: estado.sms,
        sms_numero: estado.smsNumero.trim() || null,
      });
      if (resultado.ok) {
        setMsg({ tipo: "ok", texto: "Configuração guardada." });
        router.refresh();
      } else {
        setMsg({ tipo: "erro", texto: resultado.erro });
      }
    });
  };

  return (
    <section className="lg:min-h-screen">
      <header className="border-b border-stone-200 bg-white px-5 py-5">
        <h2 className="text-2xl font-semibold text-stone-950">Notificações</h2>
        <p className="mt-1 text-sm text-stone-500">Escolha os canais e os destinos das notificações.</p>
      </header>

      <div className="grid max-w-2xl gap-4 p-5">
        {/* Avisos para o próprio negócio (este dispositivo) */}
        <NotificacoesAdminButton />

        {/* Web Push */}
        <Canal
          nome="Web Push"
          descricao="Notificações no browser / PWA do cliente. Não precisa de destino."
          ativo={estado.webPush}
          onToggle={(v) => set("webPush", v)}
        />

        {/* Email */}
        <Canal
          nome="Email"
          descricao="Confirmações e lembretes por email."
          ativo={estado.email}
          onToggle={(v) => set("email", v)}
        >
          <label className="mt-3 block text-sm font-medium text-stone-700">
            Email de envio/receção
            <Input
              type="email"
              className="mt-2"
              value={estado.emailDestino}
              onChange={(e) => set("emailDestino", e.target.value)}
              placeholder="ex.: reservas@oseunegocio.pt"
            />
          </label>
        </Canal>

        {/* WhatsApp */}
        <Canal
          nome="WhatsApp"
          descricao="Mensagens via WhatsApp."
          ativo={estado.whatsapp}
          onToggle={(v) => set("whatsapp", v)}
        >
          <label className="mt-3 block text-sm font-medium text-stone-700">
            Número de WhatsApp
            <Input
              className="mt-2"
              value={estado.whatsappNumero}
              onChange={(e) => set("whatsappNumero", e.target.value)}
              placeholder="+351 900 000 000"
            />
          </label>
        </Canal>

        {/* SMS */}
        <Canal
          nome="SMS"
          descricao="Mensagens de texto."
          ativo={estado.sms}
          onToggle={(v) => set("sms", v)}
        >
          <label className="mt-3 block text-sm font-medium text-stone-700">
            Número de SMS
            <Input
              className="mt-2"
              value={estado.smsNumero}
              onChange={(e) => set("smsNumero", e.target.value)}
              placeholder="+351 900 000 000"
            />
          </label>
        </Canal>

        {msg ? (
          <p className={`text-sm font-medium ${msg.tipo === "ok" ? "text-teal-700" : "text-red-700"}`}>{msg.texto}</p>
        ) : null}

        <div>
          <Button type="button" disabled={pending} onClick={guardar}>
            <Check size={16} />
            {pending ? "A guardar…" : "Guardar alterações"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Canal({
  nome,
  descricao,
  ativo,
  onToggle,
  children,
}: {
  nome: string;
  descricao: string;
  ativo: boolean;
  onToggle: (valor: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <label className="flex cursor-pointer items-center justify-between">
        <span>
          <span className="block font-medium text-stone-900">{nome}</span>
          <span className="mt-0.5 block text-sm text-stone-500">{descricao}</span>
        </span>
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-5 w-5 rounded border-stone-300"
        />
      </label>
      {ativo && children ? children : null}
    </div>
  );
}
