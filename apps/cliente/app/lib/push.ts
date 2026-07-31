import {
  apagarPushSubscription,
  createServiceRoleClient,
  getPushSubscriptionsAdmin,
} from "@gestor/database";
import webpush from "web-push";

let configurado = false;

function garantirVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@exemplo.pt";
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID em falta — NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não definidas.");
    return false;
  }
  if (!configurado) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configurado = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };

/** Envia um push a uma subscrição. Best-effort — nunca lança. */
export async function enviarPush(
  subscription: { endpoint: string; keys: Record<string, unknown> },
  payload: PushPayload,
): Promise<boolean> {
  if (!garantirVapid() || !subscription.endpoint) {
    return false;
  }
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys as { p256dh: string; auth: string } },
      JSON.stringify(payload),
    );
    return true;
  } catch (erro) {
    console.error("[push] falha no envio:", (erro as { statusCode?: number }).statusCode, (erro as Error).message);
    return false;
  }
}

/**
 * Notifica todos os browsers do NEGÓCIO subscritos (tipo='admin').
 * Usado quando um cliente cria/confirma/cancela/reagenda uma reserva.
 * Best-effort — limpa subscrições expiradas (404/410) e nunca lança.
 */
export async function notificarAdmins(payload: PushPayload): Promise<void> {
  try {
    if (!garantirVapid()) {
      return;
    }
    const client = createServiceRoleClient();
    const subscricoes = await getPushSubscriptionsAdmin(client);
    await Promise.all(
      subscricoes.map(async (subscricao) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscricao.endpoint, keys: subscricao.keys as { p256dh: string; auth: string } },
            JSON.stringify(payload),
          );
        } catch (erro) {
          const statusCode = (erro as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            try {
              await apagarPushSubscription(client, subscricao.endpoint);
            } catch {
              // ignorado
            }
          }
        }
      }),
    );
  } catch (erro) {
    console.error("[push] notificarAdmins falhou:", (erro as Error).message);
  }
}
