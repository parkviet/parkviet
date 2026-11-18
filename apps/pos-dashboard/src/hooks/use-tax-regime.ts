import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'
import { normalizeReadiness, type TaxReadiness } from './use-tax-profile'

export const TAX_METHODS = ['direct', 'deduction'] as const
export type TaxMethod = (typeof TAX_METHODS)[number]
export const REVENUE_GROUPS = ['group_1', 'group_2', 'group_3', 'group_4'] as const
export type RevenueGroupCode = (typeof REVENUE_GROUPS)[number]
export const PIT_METHODS = ['revenue', 'income'] as const
export type PitMethod = (typeof PIT_METHODS)[number]

export type TaxOption = {
  tax_category_id: string | null
  option: string
  method: TaxMethod
  label: string
  industry: string | null
  industry_name: string | null
  vat_rate: string | null
  pit_rate: string | null
  vat_exempt: boolean
}

export type TaxRegime = {
  id: string
  enabled: boolean
  method: TaxMethod
  revenue_group: RevenueGroupCode
  pit_method: PitMethod | null
  pit_income_rate: string | null
  prices_include_tax: boolean
  apply_reduction: boolean
  threshold_warning: boolean
  item_option: string | null
  service_fee_option: string | null
  shipping_option: string | null
  changed_by_name: string | null
  created_at: string | null
}

export type RevenueGroup = {
  code: RevenueGroupCode
  name: string
  methods: TaxMethod[]
  pit_methods: PitMethod[]
  pit_income_rate: string | null
}

export type DefaultOptions = { item: string; service_fee: string; shipping: string }

export type TaxRevenueYear = {
  year: number
  revenue: string
  threshold: string
  ratio: string
  warning: 'crossed' | 'near_80' | 'near_95' | null
  crossed_on: string | null
  crossed_period: string | null
  einvoice_deadline: string | null
  tax_due: boolean
  vat_amount: string
  pit_amount: string
  payable_amount: string
}

export type TaxRegimeState = {
  regime: TaxRegime | null
  available_options: Record<TaxMethod, TaxOption[]>
  suggested_defaults: Record<TaxMethod, DefaultOptions>
  revenue_groups: RevenueGroup[]
  product_count: number
  open_orders: number
  revenue_year: TaxRevenueYear
  readiness: TaxReadiness
  history: TaxRegime[]
}

export type TaxPreviewLine = {
  kind: 'item' | 'shipping'
  option: string
  label: string
  amount: string
  customer_amount: string
  vat_rate: string | null
  vat_amount: string | null
  pit_rate: string | null
  pit_amount: string | null
  printed: boolean
}

export type TaxPreview = {
  enabled: boolean
  method: TaxMethod
  prices_include_tax: boolean
  lines: TaxPreviewLine[]
  customer_total: string
  vat_total: string
  pit_total: string
  revenue_year: TaxRevenueYear
}

type Row = Record<string, unknown>
const record = (value: unknown): Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Row) : {}
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null
const amount = (value: unknown): string => text(value) ?? '0'
const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  allowed.find((item) => item === value) ?? null

function normalizeOption(value: unknown): TaxOption[] {
  const row = record(value)
  const option = text(row.option)
  const method = oneOf(TAX_METHODS, row.method)
  if (!option || !method) return []
  return [
    {
      tax_category_id: text(row.tax_category_id),
      option,
      method,
      label: text(row.label) ?? option,
      industry: text(row.industry),
      industry_name: text(row.industry_name),
      vat_rate: text(row.vat_rate),
      pit_rate: text(row.pit_rate),
      vat_exempt: row.vat_exempt === true,
    },
  ]
}

function normalizeRegime(value: unknown): TaxRegime | null {
  const row = record(value)
  const method = oneOf(TAX_METHODS, row.method)
  const group = oneOf(REVENUE_GROUPS, row.revenue_group)
  const id = text(row.id)
  if (!id || !method || !group) return null
  return {
    id,
    enabled: row.enabled === true,
    method,
    revenue_group: group,
    pit_method: oneOf(PIT_METHODS, row.pit_method),
    pit_income_rate: text(row.pit_income_rate),
    prices_include_tax: row.prices_include_tax === true,
    apply_reduction: row.apply_reduction === true,
    threshold_warning: row.threshold_warning === true,
    item_option: text(record(row.default_item).option),
    service_fee_option: text(record(row.default_service_fee).option),
    shipping_option: text(record(row.default_shipping).option),
    changed_by_name: text(row.changed_by_name),
    created_at: text(row.created_at),
  }
}

function normalizeDefaults(value: unknown): DefaultOptions {
  const row = record(value)
  return {
    item: text(row.item) ?? '',
    service_fee: text(row.service_fee) ?? '',
    shipping: text(row.shipping) ?? '',
  }
}

function normalizeYear(value: unknown): TaxRevenueYear {
  const row = record(value)
  const warning = text(row.warning)
  return {
    year: typeof row.year === 'number' ? row.year : new Date().getFullYear(),
    revenue: amount(row.revenue),
    threshold: amount(row.threshold),
    ratio: amount(row.ratio),
    warning:
      warning === 'crossed' || warning === 'near_80' || warning === 'near_95' ? warning : null,
    crossed_on: text(row.crossed_on),
    crossed_period: text(row.crossed_period),
    einvoice_deadline: text(row.einvoice_deadline),
    tax_due: row.tax_due === true,
    vat_amount: amount(row.vat_amount),
    pit_amount: amount(row.pit_amount),
    payable_amount: amount(row.payable_amount),
  }
}

export function normalizeTaxRegimeState(value: unknown): TaxRegimeState {
  const row = record(value)
  const available = record(row.available_options)
  const suggested = record(row.suggested_defaults)
  return {
    regime: normalizeRegime(row.regime),
    available_options: {
      direct: list(available.direct).flatMap(normalizeOption),
      deduction: list(available.deduction).flatMap(normalizeOption),
    },
    suggested_defaults: {
      direct: normalizeDefaults(suggested.direct),
      deduction: normalizeDefaults(suggested.deduction),
    },
    revenue_groups: list(row.revenue_groups).flatMap((item) => {
      const group = record(item)
      const code = oneOf(REVENUE_GROUPS, group.code)
      if (!code) return []
      return [
        {
          code,
          name: text(group.name) ?? code,
          methods: list(group.methods).flatMap((entry) => oneOf(TAX_METHODS, entry) ?? []),
          pit_methods: list(group.pit_methods).flatMap((entry) => oneOf(PIT_METHODS, entry) ?? []),
          pit_income_rate: text(group.pit_income_rate),
        },
      ]
    }),
    product_count: typeof row.product_count === 'number' ? row.product_count : 0,
    open_orders: typeof row.open_orders === 'number' ? row.open_orders : 0,
    revenue_year: normalizeYear(row.revenue_year),
    readiness: normalizeReadiness(row.readiness),
    history: list(row.history).flatMap((item) => normalizeRegime(item) ?? []),
  }
}

export function normalizeTaxPreview(value: unknown): TaxPreview {
  const row = record(value)
  return {
    enabled: row.enabled === true,
    method: oneOf(TAX_METHODS, row.method) ?? 'deduction',
    prices_include_tax: row.prices_include_tax === true,
    lines: list(row.lines).flatMap((item) => {
      const line = record(item)
      const kind = line.kind === 'item' || line.kind === 'shipping' ? line.kind : null
      if (!kind) return []
      return [
        {
          kind,
          option: text(line.option) ?? '',
          label: text(line.label) ?? '',
          amount: amount(line.amount),
          customer_amount: amount(line.customer_amount),
          vat_rate: text(line.vat_rate),
          vat_amount: text(line.vat_amount),
          pit_rate: text(line.pit_rate),
          pit_amount: text(line.pit_amount),
          printed: line.printed === true,
        },
      ]
    }),
    customer_total: amount(row.customer_total),
    vat_total: amount(row.vat_total),
    pit_total: amount(row.pit_total),
    revenue_year: normalizeYear(row.revenue_year),
  }
}

export function useTaxRegime(storeId: string | null, enabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'tax-regime', storeId),
    enabled: enabled && snapshot.status === 'authenticated' && Boolean(storeId),
    queryFn: async () =>
      normalizeTaxRegimeState(
        (await posRequest<{ data?: unknown }>('GET', '/pos/tax_regime')).data,
      ),
  })
}

export async function saveTaxRegime(body: Record<string, unknown>, applyToAllProducts: boolean) {
  return normalizeTaxRegimeState(
    (
      await posRequest<{ data?: unknown }>('PUT', '/pos/tax_regime', {
        body: { ...body, apply_to_all_products: applyToAllProducts },
      })
    ).data,
  )
}

// The sample order under an unsaved draft; a draft the server refuses keeps
// the last good preview on screen and reports the error.
export function useTaxPreview(
  storeId: string | null,
  body: Record<string, unknown>,
  enabled: boolean,
) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'tax-regime-preview', storeId, body),
    enabled: enabled && snapshot.status === 'authenticated' && Boolean(storeId),
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async () =>
      normalizeTaxPreview(
        (await posRequest<{ data?: unknown }>('POST', '/pos/tax_regime/preview', { body })).data,
      ),
  })
}
