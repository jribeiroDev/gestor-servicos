export type ReservaEstado =
  | "pendente"
  | "confirmada"
  | "cancelada"
  | "concluida"
  | "no_show";

type Empty = { [_ in never]: never };

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
        Relationships: [];
      };
      equipa: {
        Row: {
          id: string;
          nome: string;
          foto_url: string | null;
          ativo: boolean;
          ordem: number;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["equipa"]["Row"]> & {
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipa"]["Row"]>;
        Relationships: [];
      };
      horarios_funcionamento: {
        Row: {
          id: string;
          dia_semana: number;
          hora_inicio: string;
          hora_fim: string;
          profissional_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["horarios_funcionamento"]["Row"]> & {
          dia_semana: number;
          hora_inicio: string;
          hora_fim: string;
        };
        Update: Partial<Database["public"]["Tables"]["horarios_funcionamento"]["Row"]>;
        Relationships: [];
      };
      bloqueios_calendario: {
        Row: {
          id: string;
          data_inicio: string;
          data_fim: string;
          motivo: string | null;
          profissional_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["bloqueios_calendario"]["Row"]> & {
          data_inicio: string;
          data_fim: string;
        };
        Update: Partial<Database["public"]["Tables"]["bloqueios_calendario"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "bloqueios_calendario_profissional_id_fkey";
            columns: ["profissional_id"];
            referencedRelation: "equipa";
            referencedColumns: ["id"];
          },
        ];
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
          estado: ReservaEstado;
          confirmado_pelo_cliente: boolean;
          profissional_id: string | null;
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
        Relationships: [
          {
            foreignKeyName: "reservas_servico_id_fkey";
            columns: ["servico_id"];
            referencedRelation: "servicos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservas_profissional_id_fkey";
            columns: ["profissional_id"];
            referencedRelation: "equipa";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracoes_notificacao: {
        Row: {
          id: boolean;
          web_push_ativo: boolean;
          email_ativo: boolean;
          whatsapp_ativo: boolean;
          whatsapp_numero_id: string | null;
          whatsapp_numero: string | null;
          email_destino: string | null;
          sms_numero: string | null;
          sms_ativo: boolean;
          atualizado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["configuracoes_notificacao"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["configuracoes_notificacao"]["Row"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          reserva_id: string | null;
          token_acesso: string | null;
          tipo: string;
          endpoint: string;
          keys: Record<string, unknown>;
          criado_em: string;
        };
        Insert: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]> & {
          endpoint: string;
          keys: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_reserva_id_fkey";
            columns: ["reserva_id"];
            referencedRelation: "reservas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Empty;
    Functions: Empty;
    Enums: {
      reserva_estado: ReservaEstado;
    };
    CompositeTypes: Empty;
  };
};

export type Servico = Database["public"]["Tables"]["servicos"]["Row"];
export type ServicoInsert = Database["public"]["Tables"]["servicos"]["Insert"];
export type ServicoUpdate = Database["public"]["Tables"]["servicos"]["Update"];

export type Reserva = Database["public"]["Tables"]["reservas"]["Row"];
export type ReservaInsert = Database["public"]["Tables"]["reservas"]["Insert"];
export type ReservaUpdate = Database["public"]["Tables"]["reservas"]["Update"];

export type MembroEquipa = Database["public"]["Tables"]["equipa"]["Row"];
export type MembroEquipaInsert = Database["public"]["Tables"]["equipa"]["Insert"];

export type HorarioFuncionamento =
  Database["public"]["Tables"]["horarios_funcionamento"]["Row"];
export type BloqueioCalendario =
  Database["public"]["Tables"]["bloqueios_calendario"]["Row"];
export type ConfiguracaoNotificacao =
  Database["public"]["Tables"]["configuracoes_notificacao"]["Row"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
