import { describe, expect, it } from 'vitest';
import {
  acceptWindow,
  bookingReasons,
  minutesClock,
  periodProblems,
  type ReservationRules,
  rulesOf,
  sortPeriods,
} from './reservation-window';

const rules = (patch: Partial<ReservationRules> = {}): ReservationRules => ({
  periods: [
    { start: '10:00', end: '14:00' },
    { start: '17:00', end: '22:00' },
  ],
  openBuffer: 30,
  closeBuffer: 60,
  minLead: 0,
  timezone: 'Asia/Ho_Chi_Minh',
  ...patch,
});

// 2026-11-17 in Vietnam (UTC+7).
const at = (clock: string) => new Date(`2026-11-17T${clock}:00+07:00`);
const morning = new Date('2026-11-17T06:00:00+07:00');

describe('bookingReasons', () => {
  it('accepts a time inside a period, after the opening buffer and before the closing one', () => {
    expect(bookingReasons(at('10:30'), morning, rules())).toEqual([]);
    expect(bookingReasons(at('21:00'), morning, rules())).toEqual([]);
  });

  it('names each broken rule', () => {
    expect(bookingReasons(at('15:00'), morning, rules())).toEqual(['outside_periods']);
    expect(bookingReasons(at('10:10'), morning, rules())).toEqual(['before_open']);
    expect(bookingReasons(at('21:30'), morning, rules())).toEqual(['after_close']);
    expect(bookingReasons(at('11:00'), at('10:50'), rules({ minLead: 30 }))).toEqual(['too_soon']);
  });

  it('follows a period past midnight', () => {
    const late = rules({
      periods: [{ start: '22:00', end: '02:00' }],
      openBuffer: 0,
      closeBuffer: 0,
    });
    expect(bookingReasons(at('23:30'), morning, late)).toEqual([]);
    expect(bookingReasons(new Date('2026-11-18T01:00:00+07:00'), morning, late)).toEqual([]);
    expect(bookingReasons(new Date('2026-11-18T02:00:00+07:00'), morning, late)).toEqual([
      'outside_periods',
    ]);
  });

  it('reads the clock in the branch time zone', () => {
    const utc = new Date('2026-11-17T03:30:00Z'); // 10:30 in Vietnam
    expect(bookingReasons(utc, morning, rules())).toEqual([]);
    expect(bookingReasons(utc, morning, rules({ timezone: 'UTC' }))).toEqual(['outside_periods']);
  });

  it('takes any time without periods', () => {
    expect(bookingReasons(at('15:00'), morning, rules({ periods: [] }))).toEqual([]);
  });
});

describe('periodProblems', () => {
  it('lets periods touch but not overlap, also across midnight', () => {
    expect(
      periodProblems(
        [
          { start: '17:00', end: '21:00' },
          { start: '21:00', end: '02:00' },
        ],
        0,
        0,
      ),
    ).toEqual({});
    expect(
      periodProblems(
        [
          { start: '22:00', end: '03:00' },
          { start: '02:00', end: '05:00' },
        ],
        0,
        0,
      ),
    ).toEqual({ 0: 'overlap', 1: 'overlap' });
  });

  it('flags a bad clock and a period the buffers fill', () => {
    expect(periodProblems([{ start: '10:00', end: '10:00' }], 0, 0)).toEqual({ 0: 'invalid' });
    expect(periodProblems([{ start: '10:00', end: '11:00' }], 30, 30)).toEqual({ 0: 'empty' });
    expect(periodProblems([{ start: '10:00', end: '11:00' }], 30, 29)).toEqual({});
  });
});

describe('acceptWindow and sortPeriods', () => {
  it('trims the buffers off a period', () => {
    expect(acceptWindow({ start: '22:00', end: '02:00' }, 30, 60)).toEqual({
      from: 1350,
      to: 1500,
    });
    expect(minutesClock(1500)).toBe('01:00');
    expect(acceptWindow({ start: '10:00', end: '11:00' }, 30, 30)).toBeNull();
  });

  it('orders periods from the business day cutoff', () => {
    expect(
      sortPeriods(
        [
          { start: '02:00', end: '03:30' },
          { start: '17:00', end: '22:00' },
          { start: '10:00', end: '14:00' },
        ],
        '04:00',
      ).map((row) => row.start),
    ).toEqual(['10:00', '17:00', '02:00']);
  });
});

describe('rulesOf', () => {
  it('reads the effective periods and defaults what is missing', () => {
    expect(
      rulesOf({
        reservation_effective_periods: [{ start: '08:00', end: '22:00' }, { start: 1 }],
        timezone: 'UTC',
      }),
    ).toEqual({
      periods: [{ start: '08:00', end: '22:00' }],
      openBuffer: 0,
      closeBuffer: 0,
      minLead: 0,
      timezone: 'UTC',
    });
  });
});
