import { describe, expect, it } from 'vitest';
import {
  alignPrevious,
  capRange,
  chartNumber,
  cutoffHour,
  dayHours,
  matchingOverviewRange,
  type OverviewDay,
  OverviewShapeError,
  overviewRange,
  overviewRequestRange,
  parseOverview,
  percentChange,
} from './overview';
import { validReportRange } from './reports';

const totals = {
  orders: 3,
  sales_total: '300000.0',
  returns: 1,
  returns_total: '50000.0',
  net_sales: '250000.0',
  offline_orders: 1,
  offline_total: '100000.0',
  customers: 2,
};
const day = (date: string, orders = 1): OverviewDay => ({
  date,
  orders,
  customers: orders,
  sales_total: `${orders * 100000}.0`,
  returns_total: '0.0',
  net_sales: `${orders * 100000}.0`,
});
const payload = {
  branch_id: 'branch_1',
  timezone: 'Asia/Ho_Chi_Minh',
  scope: 'branch',
  from: '2026-11-15',
  to: '2026-11-16',
  previous_from: '2026-11-13',
  previous_to: '2026-11-14',
  totals,
  previous_totals: { ...totals, orders: 2 },
  by_day: [day('2026-11-15', 2), day('2026-11-16')],
  previous_by_day: [day('2026-11-13'), day('2026-11-14')],
  by_hour: [{ hour: 9, orders: 3, sales_total: '300000.0' }],
  by_source: [{ order_source: 'zalo', orders: 1, sales_total: '100000.0', owed: '0.0' }],
  top_items: {
    by_quantity: [
      {
        variant_id: 'variant_1',
        name: 'Cà phê',
        sku: null,
        base_unit: 'cup',
        quantity: 4,
        revenue: '120000.0',
      },
    ],
    by_revenue: [],
  },
  status_counts: { all: 3, debt: 1, returned: 1, refund_pending: 0 },
  stock_alerts: null,
};

describe('parseOverview', () => {
  it('reads the server payload and lists every order source', () => {
    const overview = parseOverview(payload);
    expect(overview.totals).toEqual(totals);
    expect(overview.previous_totals?.orders).toBe(2);
    expect(overview.by_day.map((row) => row.date)).toEqual(['2026-11-15', '2026-11-16']);
    expect(overview.by_source.find((row) => row.order_source === 'zalo')?.orders).toBe(1);
    expect(overview.by_source.find((row) => row.order_source === 'counter')?.orders).toBe(0);
    expect(overview.top_items.by_quantity[0]).toMatchObject({ name: 'Cà phê', quantity: 4 });
    expect(overview.status_counts).toEqual({ all: 3, debt: 1, returned: 1, refund_pending: 0 });
    expect(overview.stock_alerts).toBeNull();
  });

  it('keeps the previous period empty without a comparison', () => {
    const overview = parseOverview({
      ...payload,
      previous_from: null,
      previous_to: null,
      previous_totals: null,
      previous_by_day: null,
    });
    expect(overview.previous_totals).toBeNull();
    expect(overview.previous_by_day).toBeNull();
  });

  it('rejects a payload the widgets could not draw', () => {
    expect(() => parseOverview([])).toThrow(OverviewShapeError);
    expect(() => parseOverview({ ...payload, totals: { ...totals, sales_total: 12 } })).toThrow(
      'totals.sales_total',
    );
    expect(() => parseOverview({ ...payload, by_hour: [{ hour: 24, orders: 1 }] })).toThrow(
      OverviewShapeError,
    );
    expect(() => parseOverview({ ...payload, status_counts: { all: 1 } })).toThrow(
      'status_counts.debt',
    );
  });
});

describe('overview date picks', () => {
  const today = '2026-03-01';

  it('resolves each pick from the business day', () => {
    expect(overviewRange('today', today)).toEqual({ from: today, to: today });
    expect(overviewRange('yesterday', today)).toEqual({ from: '2026-02-28', to: '2026-02-28' });
    expect(overviewRange('last7', today)).toEqual({ from: '2026-02-23', to: today });
    expect(overviewRange('month', today)).toEqual({ from: '2026-03-01', to: today });
    expect(overviewRange('lastMonth', today)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(overviewRange('lastMonth', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('names the pick a range matches, first match winning', () => {
    expect(matchingOverviewRange({ from: '2026-02-28', to: '2026-02-28' }, today)).toBe(
      'yesterday',
    );
    expect(matchingOverviewRange({ from: today, to: today }, today)).toBe('today');
    expect(matchingOverviewRange({ from: '2026-02-10', to: '2026-02-12' }, today)).toBeNull();
  });

  it('defaults to today and reports an invalid range', () => {
    expect(overviewRequestRange({}, today)).toEqual({
      range: { from: today, to: today },
      valid: true,
    });
    expect(overviewRequestRange({ from: '2026-02-01' }, today)).toEqual({
      range: { from: '2026-02-01', to: '2026-02-01' },
      valid: true,
    });
    expect(overviewRequestRange({ from: '2026-02-10', to: '2026-02-01' }, today).valid).toBe(false);
    expect(overviewRequestRange({ from: '2024-01-01', to: '2026-01-01' }, today).valid).toBe(false);
  });
});

describe('comparison with the previous period', () => {
  it('gives the change in percent, one decimal', () => {
    expect(percentChange('150000.0', '100000.0')).toBe(50);
    expect(percentChange(2, 3)).toBe(-33.3);
    expect(percentChange('100.0', '100')).toBe(0);
  });

  it('has no percentage without a baseline', () => {
    expect(percentChange(5, null)).toBeNull();
    expect(percentChange(5, undefined)).toBeNull();
    expect(percentChange('5000.0', '0.0')).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });

  it('pairs days by their position in the period', () => {
    const current = [day('2026-11-15', 2), day('2026-11-16')];
    const previous = [day('2026-11-13', 5)];
    const aligned = alignPrevious(current, previous);
    expect(aligned[0].previous?.date).toBe('2026-11-13');
    expect(aligned[1].previous).toBeNull();
    expect(alignPrevious(current, null).every((row) => row.previous === null)).toBe(true);
  });

  it('reads amounts as numbers for drawing only', () => {
    expect(chartNumber('1250.50')).toBe(1250.5);
    expect(chartNumber('abc')).toBe(0);
    expect(chartNumber(null)).toBe(0);
    expect(chartNumber(7)).toBe(7);
  });
});

describe('business day hours', () => {
  it('starts at the cutoff hour and wraps round', () => {
    expect(dayHours(4).slice(0, 3)).toEqual([4, 5, 6]);
    expect(dayHours(4).slice(-2)).toEqual([2, 3]);
    expect(dayHours(0)).toHaveLength(24);
    expect(dayHours(30)[0]).toBe(0);
  });

  it('reads the hour of a cutoff', () => {
    expect(cutoffHour('04:00')).toBe(4);
    expect(cutoffHour('04:30:00')).toBe(4);
    expect(cutoffHour(undefined)).toBe(0);
    expect(cutoffHour('late')).toBe(0);
  });
});

describe('capRange', () => {
  it('keeps a picked range within 366 days, ending where it was picked', () => {
    const capped = capRange({ from: '2024-01-01', to: '2026-03-01' });
    expect(capped).toEqual({ from: '2025-03-01', to: '2026-03-01' });
    expect(validReportRange(capped.from, capped.to)).toBe(true);
    const short = { from: '2026-02-01', to: '2026-03-01' };
    expect(capRange(short)).toBe(short);
  });
});
