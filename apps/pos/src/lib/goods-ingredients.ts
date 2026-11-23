import { formatMoney } from '@shared/money'
import type { PriceParams, ProductCreateParams, ProductUpdateParams } from '@spree/admin-sdk'

// Pure mapping between Spree products of the `Nguyên liệu` type and what the
// ingredients screen shows and sends. An ingredient is a simple product that
// tracks stock and is never published on the `pos` channel.

export const INGREDIENT_SKU_PREFIX = 'NL'
// Units offered as one-tap choices when the store has them as stock units.
export const INGREDIENT_QUICK_UNITS = ['g', 'ml', 'kg', 'l'] as const

type StockLevelSlice = { stock_location_id: string | null; count_on_hand: number }
type VariantSlice = {
  id: string
  sku: string | null
  cost_price: string | null
  stock_levels?: StockLevelSlice[]
}
export type IngredientProductSlice = {
  id: string
  name: string
  status: string
  default_variant_id: string
  variants?: VariantSlice[]
  default_variant?: VariantSlice
}

export const STOCK_STATES = ['in_stock', 'low', 'out'] as const
export type StockState = (typeof STOCK_STATES)[number]
export const BUSINESS_STATES = ['active', 'inactive'] as const
export type BusinessState = (typeof BUSINESS_STATES)[number]

// One list row, flat so the local list can search, filter and sort it.
export type IngredientRow = {
  id: string
  variant_id: string
  name: string
  sku: string
  unit_code: string
  unit_name: string
  cost_price: string | null
  // Count at the selected branch's selling location, in the stock unit.
  on_hand: number
  // Stock value (on hand × cost), null without a cost.
  value: string | null
  stock_state: StockState
  negative: boolean
  // The branch's low-stock threshold; null when none is set.
  alert: number | null
  status: string
  business: BusinessState
}

const decimal = (value: string | null | undefined) =>
  value != null && /^-?\d+(?:\.\d+)?$/.test(value) ? value : null

// Exact product of a decimal string and a whole count, as a decimal string.
export function multiplyDecimal(amount: string, count: number) {
  const negative = amount.startsWith('-') !== count < 0
  const [whole, fraction = ''] = amount.replace(/^-/, '').split('.')
  const product = BigInt(whole + fraction) * BigInt(Math.abs(Math.trunc(count)))
  const digits = product.toString().padStart(fraction.length + 1, '0')
  const head = fraction ? digits.slice(0, -fraction.length) : digits
  const tail = fraction ? digits.slice(-fraction.length).replace(/0+$/, '') : ''
  const text = tail ? `${head}.${tail}` : head
  return negative && product !== 0n ? `-${text}` : text
}

export function stockState(onHand: number, alert: number | null): StockState {
  if (onHand <= 0) return 'out'
  if (alert !== null && onHand < alert) return 'low'
  return 'in_stock'
}

export const ingredientVariant = (product: IngredientProductSlice) =>
  product.variants?.find((variant) => variant.id === product.default_variant_id) ??
  product.default_variant ??
  product.variants?.[0]

export type IngredientRowContext = {
  // Selling stock location of the selected branch.
  locationId: string | null
  unitOf: (variantId: string) => { code: string; name: string } | null
  alertOf: (variantId: string) => number | null
}
export function ingredientRow(
  product: IngredientProductSlice,
  context: IngredientRowContext,
): IngredientRow {
  const variant = ingredientVariant(product)
  const variantId = variant?.id ?? product.default_variant_id
  const onHand = (variant?.stock_levels ?? [])
    .filter(
      (level) => context.locationId !== null && level.stock_location_id === context.locationId,
    )
    .reduce((sum, level) => sum + level.count_on_hand, 0)
  const cost = decimal(variant?.cost_price)
  const alert = context.alertOf(variantId)
  const unit = context.unitOf(variantId)
  return {
    id: product.id,
    variant_id: variantId,
    name: product.name,
    sku: variant?.sku ?? '',
    unit_code: unit?.code ?? 'item',
    unit_name: unit?.name ?? '',
    cost_price: cost,
    on_hand: onHand,
    value: cost === null ? null : multiplyDecimal(cost, onHand),
    stock_state: stockState(onHand, alert),
    negative: onHand < 0,
    alert,
    status: product.status,
    business: product.status === 'active' ? 'active' : 'inactive',
  }
}

export const INGREDIENT_COLUMNS = [
  'sku',
  'name',
  'unit',
  'cost_price',
  'on_hand',
  'value',
  'stock_state',
  'alert',
  'business',
] as const
export type IngredientColumn = (typeof INGREDIENT_COLUMNS)[number]
export type IngredientCellContext = {
  currency: string
  stockLabel: (state: StockState) => string
  businessLabel: (state: BusinessState) => string
  noAlert: string
}
// Every column as plain text, for the CSV export and text-only cells.
export function ingredientCells(
  row: IngredientRow,
  context: IngredientCellContext,
): Record<IngredientColumn, string> {
  return {
    sku: row.sku || '—',
    name: row.name,
    unit: row.unit_name || row.unit_code,
    cost_price: row.cost_price === null ? '—' : formatMoney(row.cost_price, context.currency),
    on_hand: String(row.on_hand),
    value: row.value === null ? '—' : formatMoney(row.value, context.currency),
    stock_state: context.stockLabel(row.stock_state),
    alert: row.alert === null ? context.noAlert : String(row.alert),
    business: context.businessLabel(row.business),
  }
}

// ---------------------------------------------------------------------------
// Form

export type IngredientFormValues = {
  name: string
  sku: string
  unitCode: string
  costPrice: string
  // Low-stock threshold at the selected branch; blank or 0 sets none.
  alert: string
  // Opening count per stock location id, typed as text (create only).
  openingStock: Record<string, string>
}
// Already validated and canonical (see `schemas/goods-ingredient.ts`).
export type ParsedIngredient = {
  name: string
  sku: string
  unitCode: string
  costPrice: string | null
  alert: number | null
  openingStock: Record<string, number>
}

export const emptyIngredient = (unitCode = ''): IngredientFormValues => ({
  name: '',
  sku: '',
  unitCode,
  costPrice: '',
  alert: '',
  openingStock: {},
})
export const ingredientForm = (row: IngredientRow): IngredientFormValues => ({
  name: row.name,
  sku: row.sku,
  unitCode: row.unit_code,
  costPrice: row.cost_price ?? '',
  alert: row.alert === null ? '' : String(row.alert),
  openingStock: {},
})

const costFields = (value: ParsedIngredient, currency: string) => ({
  cost_price: value.costPrice,
  ...(value.costPrice === null ? {} : { cost_currency: currency as PriceParams['currency'] }),
})

// A new ingredient tracks stock at every given selling location, starting
// from its opening count, and is published on no channel.
export function ingredientCreateBody(
  value: ParsedIngredient,
  context: { currency: string; productTypeId: string; locationIds: readonly string[] },
): ProductCreateParams {
  const locations = [...new Set(context.locationIds)]
  return {
    name: value.name,
    status: 'active',
    product_type_id: context.productTypeId,
    variants: [
      {
        sku: value.sku,
        ...costFields(value, context.currency),
        track_inventory: true,
        ...(locations.length > 0
          ? {
              stock_levels: locations.map((location) => ({
                stock_location_id: location,
                count_on_hand: value.openingStock[location] ?? 0,
              })),
            }
          : {}),
      },
    ],
  }
}

// An edit never sends stock levels: the API removes locations left out.
export function ingredientUpdateBody(
  value: ParsedIngredient,
  context: { currency: string; variantId: string },
): ProductUpdateParams {
  return {
    name: value.name,
    variants: [{ id: context.variantId, sku: value.sku, ...costFields(value, context.currency) }],
  }
}
