import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

/** Garante que há sessão; caso contrário redireciona para /login. */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
