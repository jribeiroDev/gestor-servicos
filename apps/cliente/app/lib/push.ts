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
  } catch {
    return false;
  }
}
