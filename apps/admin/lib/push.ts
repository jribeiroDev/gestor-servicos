import {
  apagarPushSubscription,
  createServiceRoleClient,
  getConfigNotificacao,
  getPushSubscriptionsByToken,
} from "@gestor/database";
import webpush from "web-push";

let configurado = false;

function garantirVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@exemplo.pt";
  if (!publicKey || !privateKey) {
    return false;
  }
  if (!configurado) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configurado = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };

/** Envia um push a uma subscrição concreta. Best-effort — nunca lança. */
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
 * Envia uma notificação web push a todas as subscrições associadas a um token
 * de reserva. Respeita a flag web_push_ativo e limpa subscrições expiradas.
 * Nunca lança — falhas de envio não devem quebrar a ação que a invoca.
 */
export async function notificarReservaPorToken(token: string, payload: PushPayload): Promise<void> {
  try {
    if (!garantirVapid()) {
      return;
    }
    const client = createServiceRoleClient();
    const config = await getConfigNotificacao(client);
    if (!config.web_push_ativo) {
      return;
    }

    const subscricoes = await getPushSubscriptionsByToken(client, token);
    await Promise.all(
      subscricoes.map(async (subscricao) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscricao.endpoint,
              keys: subscricao.keys as { p256dh: string; auth: string },
            },
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
  } catch {
    // Envio de push é best-effort.
  }
}
