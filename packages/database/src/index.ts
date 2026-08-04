export {
  createBrowserSupabaseClient,
  createServerSupabaseClient,
  createServiceRoleClient,
  type TypedSupabaseClient,
} from "./client";

export type {
  Database,
  ReservaEstado,
  Servico,
  ServicoInsert,
  ServicoUpdate,
  Reserva,
  ReservaInsert,
  ReservaUpdate,
  MembroEquipa,
  MembroEquipaInsert,
  HorarioFuncionamento,
  BloqueioCalendario,
  ConfiguracaoNotificacao,
  PushSubscriptionRow,
} from "./types";

export * from "./queries";

export {
  getSlotsDisponiveis,
  getDiasDisponiveis,
  escolherProfissionalLivre,
} from "./availability";
