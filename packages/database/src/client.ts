import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type TypedSupabaseClient = SupabaseClient<Database>;

function readPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase public environment variables are missing.");
  }

  return { url, publishableKey };
}

/**
 * Cliente para o browser (componentes "use client"). Usa a chave publishable
 * e respeita as políticas RLS. Seguro para expor no bundle do cliente.
 */
export function createBrowserSupabaseClient(): TypedSupabaseClient {
  const { url, publishableKey } = readPublicEnv();
  return createClient<Database>(url, publishableKey);
}

/**
 * Cliente para uso em Server Components / Route Handlers sem sessão.
 * Usa a chave publishable (RLS aplicado) e desliga a persistência de sessão.
 */
export function createServerSupabaseClient(): TypedSupabaseClient {
  const { url, publishableKey } = readPublicEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente com a service role (SUPABASE_SECRET_KEY). Ignora RLS — usar APENAS
 * no servidor (Route Handlers, Server Actions, cron). Lança erro se for
 * invocado no browser para evitar fuga da chave secreta.
 */
export function createServiceRoleClient(): TypedSupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createServiceRoleClient não pode ser usado no browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase service role environment variables are missing.");
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
