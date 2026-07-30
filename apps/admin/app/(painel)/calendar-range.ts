import { addDays, dateKey, generateMonthGrid, startOfWeek } from "@gestor/utils";

export type Vista = "dia" | "semana" | "mes";

export function parseDia(dia: string): Date {
  const [ano, mes, d07] = dia.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, d07 ?? 1);
}

export function calcularIntervalo(dia: string, vista: Vista): { from: string; to: string } {
  const data = parseDia(dia);
  if (vista === "dia") {
    return { from: dia, to: dia };
  }
  if (vista === "semana") {
    const inicio = startOfWeek(data);
    return { from: dateKey(inicio), to: dateKey(addDays(inicio, 6)) };
  }
  const grelha = generateMonthGrid(data);
  return { from: dateKey(grelha[0].date), to: dateKey(grelha[grelha.length - 1].date) };
}
