import { useQuery } from '@tanstack/react-query'
import { posRequest as request } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

export type MetricWithChange = {
  value: string
  previous: string
  change_pct: number | null
}

export type CountWithChange = {
  value: number
  previous: number
  change_pct: number | null
}

export type ReportPeriod = {
  from: string
  to: string
  prev_from: string
  prev_to: string
}

export type ReportOverviewData = {
  period: ReportPeriod
  currency: string
  kpis: {
    gross_sales: MetricWithChange
    net_sales: MetricWithChange
    avg_order_value: MetricWithChange
    customers_count: CountWithChange
    orders_count: CountWithChange
    gross_profit: MetricWithChange
    cost_of_goods: string
    returns_total: string
    discount_total: string
    tax_total: string
    item_total: string
  }
  trend: Array<{
    date: string
    orders: number
    customers: number
    sales_total: string
    returns_total: string
    net_sales: string
  }>
  by_source: Array<{
    order_source: string
    orders: number
    sales_total: string
    owed: string
  }>
  top_products: {
    by_quantity: Array<{
      variant_id: string
      name: string
      sku: string | null
      base_unit: string
      quantity: number
      revenue: string
    }>
    by_revenue: Array<{
      variant_id: string
      name: string
      sku: string | null
      base_unit: string
      quantity: number
      revenue: string
    }>
  }
  top_customers: Array<{ name: string; phone: string | null; orders: number; revenue: string }>
  top_staff: Array<{ name: string; orders: number; revenue: string }>
}

export type ProfitGroupBy = 'day' | 'order' | 'product' | 'customer' | 'staff'

export type ReportProfitData = {
  period: ReportPeriod
  currency: string
  pnl: {
    item_total: string
    discount_total: string
    returns_total: string
    tax_total: string
    gross_sales: string
    net_sales: string
    other_income: string
    total_revenue: string
    cogs: string
    other_expense: string
    total_expense: string
    gross_profit: string
    gross_margin_rate: number
    other_profit: string
    net_profit: string
    net_profit_change_pct: number | null
  }
  trend: Array<{
    date: string
    net_sales: string
    cogs: string
    gross_profit: string
  }>
  group_by: ProfitGroupBy
  breakdown: Array<{
    label: string
    secondary?: string | null
    count: number
    gross_sales: string
    net_sales: string
    cogs: string
    gross_profit: string
    margin_rate: number
  }>
}

export type ReportInventoryData = {
  period: ReportPeriod
  currency: string
  stock: {
    total_value: string
    total_quantity: number
    active_products: number
    inactive_products: number
    low_stock_count: number
    out_of_stock_count: number
  }
  flow: {
    import_value: MetricWithChange
    import_count: number
    export_value: MetricWithChange
    export_count: number
  }
  top_products: Array<{
    variant_id: string
    sku: string | null
    name: string
    quantity: number
    unit_cost: string
    stock_value: string
  }>
  top_categories: Array<{
    name: string
    quantity: number
    stock_value: string
  }>
  trend: Array<{
    date: string
    import_value: string
    export_value: string
  }>
}

export type InventorySummaryRow = {
  variant_id: string
  sku: string | null
  name: string
  options_text: string | null
  base_unit: string
  item_kind: 'product' | 'ingredient'
  status: string
  opening_qty: number
  opening_value: string
  inflow_qty: number
  inflow_value: string
  outflow_qty: number
  outflow_value: string
  closing_qty: number
  closing_value: string
}

export type InventorySummaryTotals = {
  opening_qty: number
  opening_value: string
  inflow_qty: number
  inflow_value: string
  outflow_qty: number
  outflow_value: string
  closing_qty: number
  closing_value: string
}

export type ReportInventorySummaryResponse = {
  data: InventorySummaryRow[]
  meta: {
    period: { from: string; to: string }
    currency: string
    total: number
    totals: InventorySummaryTotals
  }
}

export type ReportTransactionData = {
  period: ReportPeriod
  currency: string
  summary: {
    total_income: MetricWithChange
    total_expense: MetricWithChange
    net_diff: MetricWithChange
    avg_income_per_day: string
    avg_expense_per_day: string
  }
  trend: Array<{
    date: string
    income: string
    expense: string
    net: string
  }>
  income_by_category: Array<{ category_code: string; amount: string; count: number }>
  expense_by_category: Array<{ category_code: string; amount: string; count: number }>
  by_account: Array<{
    id: string
    name: string
    kind: string
    bank_name: string | null
    account_number: string | null
    period_income: string
    period_expense: string
    current_balance: string
  }>
}

export function useReportOverview(branchId: string | null, from: string, to: string) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'report-analytics', 'overview', branchId, from, to),
    enabled: Boolean(branchId) && status === 'authenticated',
    queryFn: async () =>
      (
        await request<{ data: ReportOverviewData }>('GET', '/pos/reports/overview', {
          params: { branch_id: branchId!, from, to },
        })
      ).data,
  })
}

export function useReportProfit(
  branchId: string | null,
  from: string,
  to: string,
  groupBy: ProfitGroupBy,
) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'report-analytics', 'profit', branchId, from, to, groupBy),
    enabled: Boolean(branchId) && status === 'authenticated',
    queryFn: async () =>
      (
        await request<{ data: ReportProfitData }>('GET', '/pos/reports/profit', {
          params: { branch_id: branchId!, from, to, group_by: groupBy },
        })
      ).data,
  })
}

export function useReportInventory(branchId: string | null, from: string, to: string) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'report-analytics', 'inventory', branchId, from, to),
    enabled: Boolean(branchId) && status === 'authenticated',
    queryFn: async () =>
      (
        await request<{ data: ReportInventoryData }>('GET', '/pos/reports/inventory', {
          params: { branch_id: branchId!, from, to },
        })
      ).data,
  })
}

export function useReportInventorySummary(
  branchId: string | null,
  filters: { from: string; to: string; q?: string; status?: string; item_kind?: string },
) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'report-analytics', 'inventory-summary', branchId, filters),
    enabled: Boolean(branchId) && status === 'authenticated',
    queryFn: () =>
      request<ReportInventorySummaryResponse>('GET', '/pos/reports/inventory_summary', {
        params: {
          branch_id: branchId!,
          from: filters.from,
          to: filters.to,
          ...(filters.q ? { q: filters.q } : {}),
          ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
          ...(filters.item_kind && filters.item_kind !== 'all'
            ? { item_kind: filters.item_kind }
            : {}),
        },
      }),
  })
}

export function useReportTransaction(branchId: string | null, from: string, to: string) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'report-analytics', 'transaction', branchId, from, to),
    enabled: Boolean(branchId) && status === 'authenticated',
    queryFn: async () =>
      (
        await request<{ data: ReportTransactionData }>('GET', '/pos/reports/transaction', {
          params: { branch_id: branchId!, from, to },
        })
      ).data,
  })
}
