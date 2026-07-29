export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type OpeningWindow = {
  weekday: Weekday;
  start: string;
  end: string;
};

export type CalendarBlock = {
  startsAt: string;
  endsAt: string;
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
      slots.push({
        ...candidate,
        available:
          !overlapsReservations(candidate, input.reservations ?? []) &&
          !overlapsBlocks(input.date, candidate, input.blocks ?? []),
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

function overlapsBlocks(date: Date, slot: Omit<ReservationRange, "date">, blocks: CalendarBlock[]): boolean {
  const startsAt = new Date(`${dateKey(date)}T${slot.startsAt}:00`);
  const endsAt = new Date(`${dateKey(date)}T${slot.endsAt}:00`);

  return blocks.some((block) => startsAt < new Date(block.endsAt) && endsAt > new Date(block.startsAt));
}
