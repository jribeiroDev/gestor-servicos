import { createClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      servicos: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          duracao_minutos: number;
          preco: number | null;
          ativo: boolean;
          profissional_id: string | null;
          ordem: number;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["servicos"]["Row"]> & {
          nome: string;
          duracao_minutos: number;
        };
        Update: Partial<Database["public"]["Tables"]["servicos"]["Row"]>;
      };
      reservas: {
        Row: {
          id: string;
          token_acesso: string;
          servico_id: string;
          data: string;
          hora_inicio: string;
          hora_fim: string;
          nome_cliente: string;
          telefone_cliente: string;
          estado: "pendente" | "confirmada" | "cancelada" | "concluida" | "no_show";
          confirmado_pelo_cliente: boolean;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reservas"]["Row"]> & {
          servico_id: string;
          data: string;
          hora_inicio: string;
          hora_fim: string;
          nome_cliente: string;
          telefone_cliente: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservas"]["Row"]>;
      };
    };
  };
};

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase client environment variables are missing.");
  }

  return createClient<Database>(url, anonKey);
}
