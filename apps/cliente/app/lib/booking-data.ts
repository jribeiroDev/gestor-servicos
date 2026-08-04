import {
  createServiceRoleClient,
  escolherProfissionalLivre as escolherProfissionalLivreDb,
  getDiasDisponiveis as getDiasDisponiveisDb,
  getSlotsDisponiveis as getSlotsDisponiveisDb,
  listEquipaAtiva,
  listServicosAtivos,
  type Servico,
} from "@gestor/database";
import type { Slot } from "@gestor/utils";

export async function getServicosAtivos(): Promise<Servico[]> {
  return listServicosAtivos(createServiceRoleClient());
}

export type MembroEquipaView = { id: string; nome: string; fotoUrl: string | null };

export async function getEquipaAtiva(): Promise<MembroEquipaView[]> {
  const membros = await listEquipaAtiva(createServiceRoleClient());
  return membros.map((m) => ({ id: m.id, nome: m.nome, fotoUrl: m.foto_url }));
}

export type BookingData = {
  servicos: Servico[];
  equipa: MembroEquipaView[];
  erro: boolean;
};

/**
 * Carrega serviços + equipa de forma INDEPENDENTE: uma query falhar não apaga
 * o resultado da outra (antes, um `Promise.all` fazia uma falha na equipa
 * esvaziar também os serviços). `erro` fica `true` se alguma falhou — assim o
 * cliente pode oferecer recarregar em vez de mostrar o enganador "sem serviços".
 * Nunca lança: os erros são registados e refletidos em `erro`.
 */
export async function carregarBookingData(): Promise<BookingData> {
  const [rServ, rEquipa] = await Promise.allSettled([getServicosAtivos(), getEquipaAtiva()]);

  let erro = false;
  let servicos: Servico[] = [];
  let equipa: MembroEquipaView[] = [];

  if (rServ.status === "fulfilled") {
    servicos = rServ.value;
  } else {
    erro = true;
    console.error("[booking] falha a carregar serviços:", rServ.reason);
  }
  if (rEquipa.status === "fulfilled") {
    equipa = rEquipa.value;
  } else {
    erro = true;
    console.error("[booking] falha a carregar equipa:", rEquipa.reason);
  }

  return { servicos, equipa, erro };
}

/* --------------------------------------------------------------------------
 * Disponibilidade (slots) — a lógica vive em @gestor/database (fonte única,
 * partilhada com o admin). Aqui só se injeta o cliente service-role.
 * ------------------------------------------------------------------------ */

export function getSlotsDisponiveis(
  servicoId: string,
  dia: string,
  profissionalId?: string | null,
): Promise<Slot[]> {
  return getSlotsDisponiveisDb(createServiceRoleClient(), servicoId, dia, profissionalId);
}

export function getDiasDisponiveis(
  servicoId: string,
  ano: number,
  mes: number,
  profissionalId?: string | null,
): Promise<string[]> {
  return getDiasDisponiveisDb(createServiceRoleClient(), servicoId, ano, mes, profissionalId);
}

export function escolherProfissionalLivre(
  servicoId: string,
  dia: string,
  hora: string,
): Promise<{ ok: true; profissionalId: string | null } | { ok: false }> {
  return escolherProfissionalLivreDb(createServiceRoleClient(), servicoId, dia, hora);
}
