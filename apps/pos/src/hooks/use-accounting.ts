import { useQuery } from '@tanstack/react-query'
import { useSession } from './use-session'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'

export type AccountingBookCode = 's1a' | 's2a' | 's2b' | 's2c' | 's2d' | 's2e'
export type TaxDeclarationGroup = 'cnkd' | 'vat' | 'pit'
export type TaxDeclarationType = '01_cnkd' | '01_gtgt' | '04_gtgt' | '05_kk_tncn'
export type TaxDeclarationStatus = 'draft' | 'signed' | 'submitted' | 'accepted' | 'rejected'

export interface TaxpayerSnapshot {
  store_name: string
  tax_code: string | null
  legacy_tax_code: string | null
  declaration_period: string
  tax_authority_code: string | null
  industry_code: string | null
  signer_name: string | null
  preparer_name: string | null
  storekeeper_name: string | null
  cashier_name: string | null
  readiness: {
    filled: number
    total: number
    missing: string[]
  }
  regime: {
    enabled: boolean
    method: string
    revenue_group: string
    pit_method: string
    pit_income_rate: string | null
  } | null
}

export interface AccountingBooksOverview {
  books: { code: AccountingBookCode; number: string; group: string }[]
  taxpayer: TaxpayerSnapshot
  currency: string
}

export interface AccountingBookFilters {
  period_type?: 'month' | 'quarter'
  period_year?: number
  period_number?: number
  from?: string
  to?: string
  branch_id?: string
  revenue_source?: 'all_orders' | 'einvoice_only'
  date_field?: 'completed_at' | 'created_at'
  rate_source?: 'order_time' | 'current_config'
  include_cancelled?: boolean
}

export interface RevenueBookRow {
  stt: number
  order_id: string
  document_number: string
  document_date: string | null
  description: string
  rate_key: string
  revenue: string
  vat_amount: string
  pit_amount: string
  has_einvoice: boolean
}

export interface S2cExpenseSection {
  key: 'a' | 'b' | 'c' | 'd' | 'dd' | 'e'
  amount: string
  count: number
  items: {
    id: string
    code: string
    date: string | null
    category_code: string
    description: string
    amount: string
  }[]
}

export interface S2dInventoryItem {
  variant_id: string
  sku: string
  name: string
  unit_cost: string
  opening_qty: number
  opening_value: string
  in_qty: number
  in_value: string
  out_qty: number
  out_value: string
  closing_qty: number
  closing_value: string
  movements: {
    document_code: string
    document_date: string | null
    kind: string
    description: string
    unit_cost: string
    in_qty: number
    in_value: string
    out_qty: number
    out_value: string
  }[]
}

export interface S2eAccountBook {
  account_id: string
  name: string
  kind: string
  account_number: string | null
  opening_balance: string
  total_in: string
  total_out: string
  closing_balance: string
  rows: {
    id: string
    code: string
    date: string | null
    kind: string
    description: string
    in_amount: string
    out_amount: string
    balance: string
  }[]
}

export interface AccountingBookResponse {
  book: { code: AccountingBookCode; number: string; group: string }
  from_date: string
  to_date: string
  currency: string
  options: Record<string, unknown>
  taxpayer: TaxpayerSnapshot
  summary: Record<string, string | number>
  rows?: RevenueBookRow[]
  by_rate?: {
    rate_key: string
    order_count: number
    revenue: string
    vat_amount: string
    pit_amount: string
  }[]
  expense_sections?: S2cExpenseSection[]
  revenue_rows?: RevenueBookRow[]
  items?: S2dInventoryItem[]
  accounts?: S2eAccountBook[]
}

export interface TaxDeclarationRecord {
  id: string
  code: string
  declaration_type: TaxDeclarationType
  period_type: 'month' | 'quarter'
  period_year: number
  period_number: number
  period_label: string
  from_date: string
  to_date: string
  status: TaxDeclarationStatus
  options: Record<string, unknown>
  summary: Record<string, unknown>
  taxpayer_snapshot: TaxpayerSnapshot
  note: string | null
  submitted_at: string | null
  accepted_at: string | null
  created_by_name: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

export interface TaxDeclarationsResponse {
  declarations: TaxDeclarationRecord[]
  taxpayer: TaxpayerSnapshot
  currency: string
}

export function useAccountingBooksOverview() {
  const session = useSession()
  return useQuery({
    queryKey: posKey(session.storeId, 'accounting-books-overview'),
    queryFn: () => posRequest<AccountingBooksOverview>('GET', '/pos/accounting_books'),
  })
}

export function useAccountingBook(bookCode: AccountingBookCode, filters: AccountingBookFilters) {
  const session = useSession()
  return useQuery({
    queryKey: posKey(session.storeId, 'accounting-book', bookCode, JSON.stringify(filters)),
    queryFn: () =>
      posRequest<AccountingBookResponse>('GET', `/pos/accounting_books/${bookCode}`, {
        params: {
          period_type: filters.period_type,
          period_year: filters.period_year ? String(filters.period_year) : undefined,
          period_number: filters.period_number ? String(filters.period_number) : undefined,
          from: filters.from,
          to: filters.to,
          branch_id: filters.branch_id,
          revenue_source: filters.revenue_source,
          date_field: filters.date_field,
          rate_source: filters.rate_source,
          include_cancelled: filters.include_cancelled ? 'true' : undefined,
        },
      }),
  })
}

export function useTaxDeclarations(
  group: TaxDeclarationGroup,
  filters: { q?: string; status?: string; declaration_type?: string },
) {
  const session = useSession()
  return useQuery({
    queryKey: posKey(session.storeId, 'tax-declarations', group, JSON.stringify(filters)),
    queryFn: () =>
      posRequest<TaxDeclarationsResponse>('GET', '/pos/tax_declarations', {
        params: {
          group,
          q: filters.q?.trim() || undefined,
          status: filters.status || undefined,
          declaration_type: filters.declaration_type || undefined,
        },
      }),
  })
}

export function createTaxDeclaration(body: {
  declaration_type: TaxDeclarationType
  period_type: 'month' | 'quarter'
  period_year: number
  period_number: number
  options?: Record<string, unknown>
  note?: string
}) {
  return posRequest<{ declaration: TaxDeclarationRecord }>('POST', '/pos/tax_declarations', {
    body,
  })
}

export function recalculateTaxDeclaration(id: string) {
  return posRequest<{ declaration: TaxDeclarationRecord }>(
    'POST',
    `/pos/tax_declarations/${id}/recalculate`,
  )
}

export function updateTaxDeclaration(
  id: string,
  body: { status?: TaxDeclarationStatus; note?: string | null },
) {
  return posRequest<{ declaration: TaxDeclarationRecord }>('PATCH', `/pos/tax_declarations/${id}`, {
    body,
  })
}

export function deleteTaxDeclaration(id: string) {
  return posRequest<void>('DELETE', `/pos/tax_declarations/${id}`)
}
