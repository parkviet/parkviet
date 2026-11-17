// When a branch takes bookings (GET /pos/table_settings), the same rules as the
// server's Reservations::Window. A period is { start, end } in "HH:MM", the same
// every day; an end before the start runs past midnight. A booking starts inside
// a period, after its first `openBuffer` minutes and no later than `closeBuffer`
// minutes before its end, and at least `minLead` minutes from now. No periods
// means any time. Staff bookings outside the rules are only warned about.

export const MAX_RESERVATION_PERIODS = 4;
export const RESERVATION_BUFFER_MAX = 999;
const DAY = 24 * 60;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ReservationPeriod = { start: string; end: string };

export const BOOKING_REASONS = [
  'outside_periods',
  'before_open',
  'after_close',
  'too_soon',
] as const;
export type BookingReason = (typeof BOOKING_REASONS)[number];

export type ReservationRules = {
  periods: ReservationPeriod[];
  openBuffer: number;
  closeBuffer: number;
  minLead: number;
  timezone: string;
};

export type ReservationRuleSettings = {
  reservation_periods: ReservationPeriod[];
  reservation_effective_periods: ReservationPeriod[];
  reservation_periods_source: 'branch' | 'opening_hours' | 'none';
  reservation_open_buffer_minutes: number;
  reservation_close_buffer_minutes: number;
  reservation_min_lead_minutes: number;
  reservation_duration_minutes: number;
  reservation_grace_minutes: number;
  business_day_cutoff: string;
  timezone: string;
};

export function isClock(value: string): boolean {
  return CLOCK.test(value);
}

export function clockMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

export function minutesClock(value: number): string {
  const minutes = ((Math.round(value) % DAY) + DAY) % DAY;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// [from, to] in minutes after midnight; `to` passes 1440 past midnight.
export function periodSpan(period: ReservationPeriod): [number, number] {
  const from = clockMinutes(period.start);
  let to = clockMinutes(period.end);
  if (to <= from) to += DAY;
  return [from, to];
}

// When bookings may start within a period, or null when the buffers leave none.
export function acceptWindow(
  period: ReservationPeriod,
  openBuffer: number,
  closeBuffer: number,
): { from: number; to: number } | null {
  const [from, to] = periodSpan(period);
  const first = from + openBuffer;
  const last = to - closeBuffer;
  return last > first ? { from: first, to: last } : null;
}

function overlap(one: [number, number], other: [number, number]): boolean {
  return [-DAY, 0, DAY].some((shift) => one[0] < other[1] + shift && other[0] + shift < one[1]);
}

export type PeriodProblem = 'invalid' | 'overlap' | 'empty';

// The problem of each period, by index; empty when all can be saved.
export function periodProblems(
  periods: ReservationPeriod[],
  openBuffer: number,
  closeBuffer: number,
): Record<number, PeriodProblem> {
  const problems: Record<number, PeriodProblem> = {};
  const valid = periods.map(
    (period) => isClock(period.start) && isClock(period.end) && period.start !== period.end,
  );
  periods.forEach((period, index) => {
    if (!valid[index]) {
      problems[index] = 'invalid';
      return;
    }
    const span = periodSpan(period);
    const clash = periods.some(
      (other, position) =>
        position !== index && valid[position] && overlap(span, periodSpan(other)),
    );
    if (clash) problems[index] = 'overlap';
    else if (span[1] - span[0] <= openBuffer + closeBuffer) problems[index] = 'empty';
  });
  return problems;
}

// Periods ordered from the business day's cutoff, as the server stores them.
export function sortPeriods(periods: ReservationPeriod[], cutoff: string): ReservationPeriod[] {
  const origin = clockMinutes(cutoff);
  return [...periods].sort(
    (left, right) =>
      ((clockMinutes(left.start) - origin + DAY) % DAY) -
      ((clockMinutes(right.start) - origin + DAY) % DAY),
  );
}

export function localMinute(at: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return at.getHours() * 60 + at.getMinutes();
  }
}

// The rules a booking at `startsAt` breaks; empty when it follows them all.
export function bookingReasons(
  startsAt: Date,
  now: Date,
  rules: ReservationRules,
): BookingReason[] {
  const found: BookingReason[] = [];
  if (rules.periods.length > 0) {
    const minute = localMinute(startsAt, rules.timezone);
    const span = rules.periods
      .map(periodSpan)
      .find(
        ([from, to]) =>
          (minute >= from && minute < to) || (minute + DAY >= from && minute + DAY < to),
      );
    if (!span) {
      found.push('outside_periods');
    } else {
      const offset = (((minute - span[0]) % DAY) + DAY) % DAY;
      if (offset < rules.openBuffer) found.push('before_open');
      if (offset > span[1] - span[0] - rules.closeBuffer) found.push('after_close');
    }
  }
  if (startsAt.getTime() < now.getTime() + rules.minLead * 60_000) found.push('too_soon');
  return found;
}

function clockList(value: unknown): ReservationPeriod[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const source =
      typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : null;
    const start = typeof source?.start === 'string' ? source.start : null;
    const end = typeof source?.end === 'string' ? source.end : null;
    return start && end ? [{ start, end }] : [];
  });
}

function minutes(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

// The booking rules of a table settings response.
export function rulesOf(
  settings: Partial<Record<keyof ReservationRuleSettings, unknown>>,
): ReservationRules {
  return {
    periods: clockList(settings.reservation_effective_periods),
    openBuffer: minutes(settings.reservation_open_buffer_minutes, 0),
    closeBuffer: minutes(settings.reservation_close_buffer_minutes, 0),
    minLead: minutes(settings.reservation_min_lead_minutes, 0),
    timezone:
      typeof settings.timezone === 'string' && settings.timezone
        ? settings.timezone
        : 'Asia/Ho_Chi_Minh',
  };
}

export function readPeriods(value: unknown): ReservationPeriod[] {
  return clockList(value);
}
