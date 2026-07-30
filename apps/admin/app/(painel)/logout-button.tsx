"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  const [aSair, setASair] = useState(false);

  const sair = async () => {
    setASair(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setASair(false);
    }
  };

  return (
    <button
      type="button"
      onClick={sair}
      disabled={aSair}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 disabled:opacity-50"
    >
      <LogOut size={17} />
      {aSair ? "A sair…" : "Terminar sessão"}
    </button>
  );
}
