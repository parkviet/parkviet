// The POS dashboard home page's figures for one branch over a range of
// business dates (GET /pos/overview), the date picks of its filter bar and
// the comparison with the period just before. Amounts are canonical decimal
// strings from the server; numbers derived here are for display only.

import { type OrderSourceRow, orderSourceRows, rangePreset } from './order-source';
import { validReportRange } from './reports';

export type OverviewTotals = {
  orders: number;
  sales_total: string;
  returns: number;
  returns_total: string;
  net_sales: string;
  offline_orders: number;
  offline_total: string;
  // Customer visits: each registered customer once, each walk-in order once.
  customers: number;
};

// One business date. Daily customer visits do not add up to the period's:
// a customer who came on two days is one visit in the total.
export type OverviewDay = {
  date: string;
  orders: number;
  customers: number;
  sales_total: string;
  returns_total: string;
  net_sales: string;
};

export type OverviewHour = { hour: number; orders: number; sales_total: string };

export type OverviewTopItem = {
  variant_id: string | null;
  name: string;
  sku: string | null;
  base_unit: string;
  quantity: number;
  revenue: string;
};

export type OverviewTopItems = { by_quantity: OverviewTopItem[]; by_revenue: OverviewTopItem[] };

// Orders of the period under each status of the order list.
export const OVERVIEW_STATUSES = ['all', 'debt', 'returned', 'refund_pending'] as const;
export type OverviewStatus = (typeof OVERVIEW_STATUSES)[number];
export type OverviewStatusCounts = Record<OverviewStatus, number>;

export type OverviewStockAlerts = {
  out_of_stock: number;
  low_stock: number;
  expiring_soon: number;
  near_expiry_days: number;
};

export type Overview = {
  branch_id: string;
  timezone: string;
  scope: 'branch' | 'own';
  from: string;
  to: string;
  previous_from: string | null;
  previous_to: string | null;
  totals: OverviewTotals;
  previous_totals: OverviewTotals | null;
  by_day: OverviewDay[];
  previous_by_day: OverviewDay[] | null;
  by_hour: OverviewHour[];
  by_source: OrderSourceRow[];
  top_items: OverviewTopItems;
  status_counts: OverviewStatusCounts;
  // Null for readers who cannot see the branch's stock alerts.
  stock_alerts: OverviewStockAlerts | null;
};

export class OverviewShapeError extends Error {
  constructor(field: string) {
    super(`Unexpected overview payload: ${field}`);
    this.name = 'OverviewShapeError';
  }
}

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const DECIMAL = /^-?\d+(?:\.\d+)?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function record(value: unknown, field: string): Fields {
  if (!isRecord(value)) throw new OverviewShapeError(field);
  return value;
}
function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    throw new OverviewShapeError(field);
  return value;
}
function amount(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DECIMAL.test(value)) throw new OverviewShapeError(field);
  return value;
}
function day(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DAY.test(value)) throw new OverviewShapeError(field);
  return value;
}
function list<T>(value: unknown, field: string, read: (item: unknown, field: string) => T): T[] {
  if (!Array.isArray(value)) throw new OverviewShapeError(field);
  return value.map((item, index) => read(item, `${field}[${index}]`));
}
const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);

function totals(value: unknown, field: string): OverviewTotals {
  const row = record(value, field);
  return {
    orders: count(row.orders, `${field}.orders`),
    sales_total: amount(row.sales_total, `${field}.sales_total`),
    returns: count(row.returns, `${field}.returns`),
    returns_total: amount(row.returns_total, `${field}.returns_total`),
    net_sales: amount(row.net_sales, `${field}.net_sales`),
    offline_orders: count(row.offline_orders, `${field}.offline_orders`),
    offline_total: amount(row.offline_total, `${field}.offline_total`),
    customers: count(row.customers, `${field}.customers`),
  };
}

function overviewDay(value: unknown, field: string): OverviewDay {
  const row = record(value, field);
  return {
    date: day(row.date, `${field}.date`),
    orders: count(row.orders, `${field}.orders`),
    customers: count(row.customers, `${field}.customers`),
    sales_total: amount(row.sales_total, `${field}.sales_total`),
    returns_total: amount(row.returns_total, `${field}.returns_total`),
    net_sales: amount(row.net_sales, `${field}.net_sales`),
  };
}

function hour(value: unknown, field: string): OverviewHour {
  const row = record(value, field);
  const at = count(row.hour, `${field}.hour`);
  if (at > 23) throw new OverviewShapeError(`${field}.hour`);
  return {
    hour: at,
    orders: count(row.orders, `${field}.orders`),
    sales_total: amount(row.sales_total, `${field}.sales_total`),
  };
}

function topItem(value: unknown, field: string): OverviewTopItem {
  const row = record(value, field);
  return {
    variant_id: text(row.variant_id),
    name: typeof row.name === 'string' ? row.name : '',
    sku: text(row.sku),
    base_unit: text(row.base_unit) ?? 'item',
    quantity: count(row.quantity, `${field}.quantity`),
    revenue: amount(row.revenue, `${field}.revenue`),
  };
}

function stockAlerts(value: unknown): OverviewStockAlerts | null {
  if (value === null || value === undefined) return null;
  const row = record(value, 'stock_alerts');
  return {
    out_of_stock: count(row.out_of_stock, 'stock_alerts.out_of_stock'),
    low_stock: count(row.low_stock, 'stock_alerts.low_stock'),
    expiring_soon: count(row.expiring_soon, 'stock_alerts.expiring_soon'),
    near_expiry_days: count(row.near_expiry_days, 'stock_alerts.near_expiry_days'),
  };
}

// Reads the server's overview, throwing OverviewShapeError on anything the
// widgets could not draw, so a damaged payload shows as a failure instead of
// wrong figures.
export function parseOverview(value: unknown): Overview {
  const data = record(value, 'data');
  const compared = data.previous_totals !== null && data.previous_totals !== undefined;
  const top = record(data.top_items, 'top_items');
  const statuses = record(data.status_counts, 'status_counts');
  return {
    branch_id: typeof data.branch_id === 'string' ? data.branch_id : '',
    timezone: typeof data.timezone === 'string' ? data.timezone : '',
    scope: data.scope === 'own' ? 'own' : 'branch',
    from: day(data.from, 'from'),
    to: day(data.to, 'to'),
    previous_from: compared ? day(data.previous_from, 'previous_from') : null,
    previous_to: compared ? day(data.previous_to, 'previous_to') : null,
    totals: totals(data.totals, 'totals'),
    previous_totals: compared ? totals(data.previous_totals, 'previous_totals') : null,
    by_day: list(data.by_day, 'by_day', overviewDay),
    previous_by_day: compared ? list(data.previous_by_day, 'previous_by_day', overviewDay) : null,
    by_hour: list(data.by_hour, 'by_hour', hour),
    by_source: orderSourceRows(list(data.by_source, 'by_source', record)),
    top_items: {
      by_quantity: list(top.by_quantity, 'top_items.by_quantity', topItem),
      by_revenue: list(top.by_revenue, 'top_items.by_revenue', topItem),
    },
    status_counts: Object.fromEntries(
      OVERVIEW_STATUSES.map((status) => [
        status,
        count(statuses[status], `status_counts.${status}`),
      ]),
    ) as OverviewStatusCounts,
    stock_alerts: stockAlerts(data.stock_alerts),
  };
}

// Quick date picks of the home page, as branch business days.
export const OVERVIEW_RANGES = ['today', 'yesterday', 'last7', 'month', 'lastMonth'] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];
export type DayRange = { from: string; to: string };

function shiftDay(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function overviewRange(range: OverviewRange, today: string): DayRange {
  if (range === 'yesterday') {
    const yesterday = shiftDay(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (range === 'lastMonth') {
    const lastDay = shiftDay(`${today.slice(0, 8)}01`, -1);
    return { from: `${lastDay.slice(0, 8)}01`, to: lastDay };
  }
  return rangePreset(range, today);
}

// The pick a range matches, or null for a range chosen on the calendar.
export function matchingOverviewRange(range: DayRange, today: string): OverviewRange | null {
  return (
    OVERVIEW_RANGES.find((pick) => {
      const candidate = overviewRange(pick, today);
      return candidate.from === range.from && candidate.to === range.to;
    }) ?? null
  );
}

// The range the page asks for: the URL's when it is a valid range, today's
// when neither end is given. A half or invalid range is reported as such.
export function overviewRequestRange(
  search: { from?: string; to?: string },
  today: string,
): { range: DayRange; valid: boolean } {
  if (!search.from && !search.to) return { range: { from: today, to: today }, valid: true };
  const range = { from: search.from ?? search.to ?? today, to: search.to ?? search.from ?? today };
  return { range, valid: validReportRange(range.from, range.to) };
}

// A decimal string or count as a number, for chart geometry and ratios only.
export function chartNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string' || !DECIMAL.test(value)) return 0;
  return Number(value);
}

// Change against the previous period in percent, rounded to one decimal.
// Null when there is nothing to compare with: no previous period, or a
// previous figure of zero under a current one that is not (growth from
// nothing has no percentage). Zero against zero is no change.
export function percentChange(
  current: string | number,
  previous: string | number | null | undefined,
): number | null {
  if (previous === null || previous === undefined) return null;
  const now = chartNumber(current);
  const before = chartNumber(previous);
  if (before === 0) return now === 0 ? 0 : null;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}

export type ComparedDay = { day: OverviewDay; previous: OverviewDay | null };

// Pairs each day with the day at the same position of the previous period,
// which is equally long, so day one is compared with day one.
export function alignPrevious(
  days: readonly OverviewDay[],
  previous: readonly OverviewDay[] | null,
): ComparedDay[] {
  return days.map((day, index) => ({ day, previous: previous?.[index] ?? null }));
}

// The hours of a business day in order, from the hour it starts (the day
// cutoff, 4 for 04:00) round to the hour before.
export function dayHours(startHour: number): number[] {
  const start = Number.isInteger(startHour) && startHour >= 0 && startHour < 24 ? startHour : 0;
  return Array.from({ length: 24 }, (_, index) => (start + index) % 24);
}

// The hour a business day starts from its cutoff ("04:00"); midnight when
// the cutoff is missing or malformed.
export function cutoffHour(cutoff: string | null | undefined): number {
  const hour = Number(/^(\d{1,2}):\d{2}/.exec(cutoff ?? '')?.[1]);
  return Number.isInteger(hour) && hour < 24 ? hour : 0;
}

// A picked range kept within the days the server accepts: a longer one
// keeps its end and starts `maxDays - 1` days before it.
export function capRange(range: DayRange, maxDays = 366): DayRange {
  const from = shiftDay(range.to, -(maxDays - 1));
  return range.from < from ? { from, to: range.to } : range;
}
