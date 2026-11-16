import { describe, expect, it } from 'vitest'
import {
  drillHref,
  orderSourceLink,
  ordersLink,
  salesDayLink,
  salesReportLink,
  stockAlertsLink,
} from './home-links'

const range = { from: '2026-11-01', to: '2026-11-16' }

describe('home drill-down links', () => {
  it('opens the sales report over the same days', () => {
    expect(drillHref(salesReportLink('store_1', range))).toBe(
      '/store_1/reports?from=2026-11-01&to=2026-11-16',
    )
  })

  it('opens the returns section and one order source', () => {
    expect(drillHref(salesReportLink('store_1', range, { section: 'returns' }))).toBe(
      '/store_1/reports?from=2026-11-01&to=2026-11-16&section=returns',
    )
    expect(drillHref(orderSourceLink('store_1', range, 'zalo'))).toBe(
      '/store_1/reports?from=2026-11-01&to=2026-11-16&orderSource=zalo',
    )
  })

  it('opens one day of sales', () => {
    expect(salesDayLink('store_1', '2026-11-05')).toEqual({
      to: '/store_1/reports',
      search: { from: '2026-11-05', to: '2026-11-05' },
    })
  })

  it('opens the order list over the same days under a status, every status for all', () => {
    const days = [
      { id: 'placed_at-gteq', field: 'placed_at', operator: 'gteq', value: '2026-11-01' },
      { id: 'placed_at-lteq', field: 'placed_at', operator: 'lteq', value: '2026-11-16' },
    ]
    expect(ordersLink('store_1', 'debt', range)).toEqual({
      to: '/store_1/orders',
      search: { status: 'debt', filters: days },
    })
    expect(ordersLink('store_1', 'all', range).search).toEqual({ filters: days })
    expect(drillHref(ordersLink('store_1', 'all', range))).toBe(
      `/store_1/orders?filters=${encodeURIComponent(JSON.stringify(days)).replaceAll('%20', '+')}`,
    )
    expect(drillHref(stockAlertsLink('store_1'))).toBe('/store_1/stock-alerts')
  })
})
