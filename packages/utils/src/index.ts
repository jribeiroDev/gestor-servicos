export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type OpeningWindow = {
  weekday: Weekday;
  start: string;
  end: string;
};

export type CalendarBlock = {
  /** ISO timestamp ("2026-08-05T10:00:00Z") ou data simples ("2026-08-05"). */
  startsAt: string;
  endsAt: string;
  motivo?: string | null;
};

export type ReservationRange = {
  date: string;
  startsAt: string;
  endsAt: string;
};

export type Slot = {
  date: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  /**
   * Preenchido quando o horário está indisponível por um bloqueio de
   * calendário (não por outra reserva). Null nos restantes casos.
   */
  blockedReason?: string | null;
};

const pad = (value: number) => value.toString().padStart(2, "0");

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

/** Início da semana (segunda-feira) que contém a data indicada. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dia = start.getDay();
  const desvio = dia === 0 ? -6 : 1 - dia;
  start.setDate(start.getDate() + desvio);
  return start;
}

export type MonthDay = { date: Date; inMonth: boolean };

/** Grelha de 6 semanas (42 dias, começando à segunda) para o mês da data indicada. */
export function generateMonthGrid(date: Date): MonthDay[] {
  const primeiroDoMes = new Date(date.getFullYear(), date.getMonth(), 1);
  const inicioGrelha = startOfWeek(primeiroDoMes);
  return Array.from({ length: 42 }, (_, i) => {
    const dia = addDays(inicioGrelha, i);
    return { date: dia, inMonth: dia.getMonth() === date.getMonth() };
  });
}

export function compareTime(left: string, right: string): number {
  return left.localeCompare(right);
}

export function generateSlots(input: {
  date: Date;
  durationMinutes: number;
  openingWindows: OpeningWindow[];
  reservations?: ReservationRange[];
  blocks?: CalendarBlock[];
}): Slot[] {
  const day = input.date.getDay() as Weekday;
  const key = dateKey(input.date);
  const windows = input.openingWindows.filter((window) => window.weekday === day);

  return windows.flatMap((window) => {
    const slots: Slot[] = [];
    let cursor = window.start;

    while (compareTime(addMinutes(cursor, input.durationMinutes), window.end) <= 0) {
      const endsAt = addMinutes(cursor, input.durationMinutes);
      const candidate = { date: key, startsAt: cursor, endsAt };
      const bloqueio = findBlock(input.date, candidate, input.blocks ?? []);
      const ocupado = overlapsReservations(candidate, input.reservations ?? []);
      slots.push({
        ...candidate,
        available: !ocupado && !bloqueio,
        blockedReason: bloqueio ? bloqueio.motivo?.trim() || "Período indisponível" : null,
      });
      cursor = endsAt;
    }

    return slots;
  });
}

function overlapsReservations(slot: ReservationRange, reservations: ReservationRange[]): boolean {
  return reservations.some(
    (reservation) =>
      reservation.date === slot.date &&
      compareTime(slot.startsAt, reservation.endsAt) < 0 &&
      compareTime(slot.endsAt, reservation.startsAt) > 0,
  );
}

const APENAS_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte um limite de bloqueio em Date. Aceita ISO completo ou data simples;
 * neste último caso o bloqueio cobre o dia inteiro (fim inclusivo), para que
 * um bloqueio "05/08 → 05/08" bloqueie mesmo esse dia e não um intervalo nulo.
 */
function parseBlockBoundary(value: string, isEnd: boolean): Date {
  if (APENAS_DATA.test(value)) {
    const [ano, mes, dia] = value.split("-").map(Number);
    return isEnd
      ? new Date(ano, mes - 1, dia, 23, 59, 59, 999)
      : new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  }
  return new Date(value);
}

/** Bloqueio que cobre este horário, se existir. */
function findBlock(
  date: Date,
  slot: Omit<ReservationRange, "date">,
  blocks: CalendarBlock[],
): CalendarBlock | undefined {
  const startsAt = new Date(`${dateKey(date)}T${slot.startsAt}:00`);
  const endsAt = new Date(`${dateKey(date)}T${slot.endsAt}:00`);

  return blocks.find(
    (block) =>
      startsAt < parseBlockBoundary(block.endsAt, true) &&
      endsAt > parseBlockBoundary(block.startsAt, false),
  );
}
