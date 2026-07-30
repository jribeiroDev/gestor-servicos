import { fetchConfigNotificacao } from "../../../lib/admin-data";
import { NotificacoesClient } from "./notificacoes-client";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const config = await fetchConfigNotificacao();
  return (
    <NotificacoesClient
      config={{
        webPush: config.web_push_ativo,
        email: config.email_ativo,
        emailDestino: config.email_destino ?? "",
        whatsapp: config.whatsapp_ativo,
        whatsappNumero: config.whatsapp_numero ?? "",
        sms: config.sms_ativo,
        smsNumero: config.sms_numero ?? "",
      }}
    />
  );
}
