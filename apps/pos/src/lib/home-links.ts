import type { OrderSource } from '@shared/order-source'
import type { DayRange, OverviewStatus } from '@shared/overview'
import type { ReportSearch } from '../schemas/report-search'

// Where a home widget leads: a dashboard path and the filters of the page it
// opens, under the keys that page reads from its URL. The selected branch
// travels on its own (the store route retains it).
export type DrillLink = { to: string; search?: Record<string, unknown> }

type SalesFilter = Pick<ReportSearch, 'section' | 'orderSource'>

// The sales report over the same days, optionally on its returns section or
// one order source.
export function salesReportLink(
  storeId: string,
  range: DayRange,
  filter: SalesFilter = {},
): DrillLink {
  const search: Record<string, string> = { from: range.from, to: range.to }
  if (filter.section) search.section = filter.section
  if (filter.orderSource) search.orderSource = filter.orderSource
  return { to: `/${storeId}/reports`, search }
}

// The sales report of one business day.
export const salesDayLink = (storeId: string, date: string) =>
  salesReportLink(storeId, { from: date, to: date })

export const orderSourceLink = (storeId: string, range: DayRange, orderSource: OrderSource) =>
  salesReportLink(storeId, range, { orderSource })

// The order list over the same days, under one of its statuses ("all" is
// every status). The days go to the table's own date filter on the order
// time, as the list's date picker sets it.
export function ordersLink(storeId: string, status: OverviewStatus, range: DayRange): DrillLink {
  const filters = [
    { id: 'placed_at-gteq', field: 'placed_at', operator: 'gteq', value: range.from },
    { id: 'placed_at-lteq', field: 'placed_at', operator: 'lteq', value: range.to },
  ]
  return {
    to: `/${storeId}/orders`,
    search: status === 'all' ? { filters } : { status, filters },
  }
}

export const stockAlertsLink = (storeId: string): DrillLink => ({ to: `/${storeId}/stock-alerts` })

// The link as an address, for tests and plain anchors: strings as they are,
// structured filters as JSON, as the router writes them.
export function drillHref({ to, search }: DrillLink): string {
  const query = new URLSearchParams(
    Object.entries(search ?? {}).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  ).toString()
  return query ? `${to}?${query}` : to
}
