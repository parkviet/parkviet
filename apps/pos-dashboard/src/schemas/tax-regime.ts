import { z } from 'zod'
import {
  PIT_METHODS,
  REVENUE_GROUPS,
  type RevenueGroup,
  type RevenueGroupCode,
  TAX_METHODS,
  type TaxMethod,
  type TaxOption,
  type TaxRegime,
  type TaxRegimeState,
} from '../hooks/use-tax-regime'

// Shape of the form; which combinations exist is the catalog's call, read
// from the server state (see `validateTaxRegime`), and the server stays the
// authority and maps its own errors.
const option = z.string().min(1, 'taxRegime.errorOption')
export const taxRegimeSchema = z.object({
  enabled: z.boolean(),
  method: z.enum(TAX_METHODS),
  revenue_group: z.enum(REVENUE_GROUPS),
  pit_method: z.enum(PIT_METHODS),
  item_option: option,
  service_fee_option: option,
  shipping_option: option,
  prices_include_tax: z.boolean(),
  apply_reduction: z.boolean(),
  threshold_warning: z.boolean(),
})
export type TaxRegimeValues = z.infer<typeof taxRegimeSchema>
export type TaxRegimeField = keyof TaxRegimeValues

export const OPTION_FIELDS = ['item_option', 'service_fee_option', 'shipping_option'] as const

export function revenueGroup(state: TaxRegimeState, code: RevenueGroupCode): RevenueGroup | null {
  return state.revenue_groups.find((group) => group.code === code) ?? null
}

function defaultsOf(state: TaxRegimeState, method: TaxMethod) {
  const suggested = state.suggested_defaults[method]
  return {
    item_option: suggested.item,
    service_fee_option: suggested.service_fee,
    shipping_option: suggested.shipping,
  }
}

function pitFor(state: TaxRegimeState, group: RevenueGroupCode, current: string | null) {
  const allowed = revenueGroup(state, group)?.pit_methods ?? []
  return allowed.find((method) => method === current) ?? allowed[0] ?? 'revenue'
}

// The form's starting point: the regime in force, or what a store without
// one is offered (deduction, prices with VAT, the profile's suggested options).
export function regimeValues(state: TaxRegimeState): TaxRegimeValues {
  const regime: TaxRegime | null = state.regime
  if (!regime) {
    const group: RevenueGroupCode = 'group_3'
    return {
      enabled: true,
      method: 'deduction',
      revenue_group: group,
      pit_method: pitFor(state, group, null),
      ...defaultsOf(state, 'deduction'),
      prices_include_tax: true,
      apply_reduction: false,
      threshold_warning: true,
    }
  }
  const fallback = defaultsOf(state, regime.method)
  return {
    enabled: regime.enabled,
    method: regime.method,
    revenue_group: regime.revenue_group,
    pit_method: pitFor(state, regime.revenue_group, regime.pit_method),
    item_option: regime.item_option ?? fallback.item_option,
    service_fee_option: regime.service_fee_option ?? fallback.service_fee_option,
    shipping_option: regime.shipping_option ?? fallback.shipping_option,
    prices_include_tax: regime.prices_include_tax,
    apply_reduction: regime.apply_reduction,
    threshold_warning: regime.threshold_warning,
  }
}

// A method switch starts from the saved defaults when it returns to the saved
// method, otherwise from the profile's suggestion for the new one.
export function withMethod(
  values: TaxRegimeValues,
  method: TaxMethod,
  state: TaxRegimeState,
): TaxRegimeValues {
  if (values.method === method) return values
  const saved = regimeValues(state)
  const options = saved.method === method ? saved : defaultsOf(state, method)
  return {
    ...values,
    method,
    item_option: options.item_option,
    service_fee_option: options.service_fee_option,
    shipping_option: options.shipping_option,
  }
}

// A group allows some methods and income-tax methods; the draft moves to the
// first allowed one when its current choice is not among them.
export function withRevenueGroup(
  values: TaxRegimeValues,
  code: RevenueGroupCode,
  state: TaxRegimeState,
): TaxRegimeValues {
  const group = revenueGroup(state, code)
  const next = {
    ...values,
    revenue_group: code,
    pit_method: pitFor(state, code, values.pit_method),
  }
  const method = group?.methods.includes(next.method) ? next.method : group?.methods[0]
  return method ? withMethod(next, method, state) : next
}

export const sameValues = (a: TaxRegimeValues, b: TaxRegimeValues) =>
  (Object.keys(a) as TaxRegimeField[]).every((key) => a[key] === b[key])

export type RegimeChange = {
  unsaved: boolean
  methodChanged: boolean
  defaultsChanged: boolean
  pricesBecomeExclusive: boolean
}

// What a save would do to the products, for the confirmation: a new method
// reassigns every product; new defaults of the same method move the products
// that follow the defaults.
export function regimeChange(values: TaxRegimeValues, state: TaxRegimeState): RegimeChange {
  const saved = regimeValues(state)
  const methodChanged = state.regime !== null && values.method !== saved.method
  return {
    unsaved: state.regime === null,
    methodChanged,
    defaultsChanged:
      state.regime !== null &&
      !methodChanged &&
      OPTION_FIELDS.some((field) => values[field] !== saved[field]),
    pricesBecomeExclusive:
      state.regime !== null &&
      values.method === 'deduction' &&
      saved.method === 'deduction' &&
      saved.prices_include_tax &&
      !values.prices_include_tax,
  }
}

// The API takes every field; the saved regime supplies nothing the draft lacks.
export function regimeBody(values: TaxRegimeValues): Record<string, unknown> {
  return { ...values }
}

export type RegimeIssues = Partial<Record<TaxRegimeField, string>>

export function validateTaxRegime(values: TaxRegimeValues, state: TaxRegimeState): RegimeIssues {
  const issues: RegimeIssues = {}
  const parsed = taxRegimeSchema.safeParse(values)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as TaxRegimeField
      issues[key] ??= issue.message
    }
  }
  const group = revenueGroup(state, values.revenue_group)
  if (!group) issues.revenue_group = 'taxRegime.errorGroup'
  else {
    if (!group.methods.includes(values.method)) issues.method = 'taxRegime.errorMethod'
    if (!group.pit_methods.includes(values.pit_method)) issues.pit_method = 'taxRegime.errorPit'
  }
  const allowed = new Set(state.available_options[values.method].map((item) => item.option))
  for (const field of OPTION_FIELDS)
    if (values[field] && !allowed.has(values[field])) issues[field] = 'taxRegime.errorOption'
  return issues
}

export type OptionGroup = { key: string; name: string; options: TaxOption[] }

// Options grouped by industry, in the order the catalog lists them; the two
// variants of an industry (with and without VAT) share a group.
export function optionGroups(options: TaxOption[]): OptionGroup[] {
  const groups: OptionGroup[] = []
  for (const item of options) {
    const key = item.industry ?? item.option
    const found = groups.find((group) => group.key === key)
    if (found) found.options.push(item)
    else groups.push({ key, name: item.industry_name ?? item.label, options: [item] })
  }
  return groups
}

// A fraction as a percentage without trailing zeros: "0.015" is "1.5".
export function percentOf(fraction: string | null): string {
  if (fraction === null) return ''
  const value = Number(fraction) * 100
  return Number.isFinite(value) ? String(Number(value.toFixed(4))) : ''
}

export function optionOf(
  state: TaxRegimeState,
  method: TaxMethod,
  key: string,
): TaxOption | undefined {
  return state.available_options[method].find((item) => item.option === key)
}

// Where the year's revenue stands against the threshold, 0 to 1 for the bar.
export function thresholdFill(ratio: string): number {
  const value = Number(ratio)
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0
}

// "2026-07-15" as "15/07/2026"; the server's business dates carry no time zone.
export function formatDay(iso: string | null): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—'
}
