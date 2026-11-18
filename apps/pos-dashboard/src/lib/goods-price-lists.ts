import type { PriceBulkUpsertRowParams, PriceParams } from '@spree/admin-sdk'

// A product's prices in Spree price lists: the list's own price of each
// variant (the bottom rung, quantity 1) and, on a list with a volume rule,
// quantity breaks (`min_quantity` above 1). Form values stay plain strings.

// A variant carries at most ten rungs on one list per currency.
export const MAX_RUNGS = 10
const MAX_QUANTITY = 1_000_000

type PriceSlice = {
  id: string
  variant_id: string | null
  price_list_id: string | null
  currency: string | null
  amount: string | null
  min_quantity: number
}
type RuleSlice = { type: string; preferences: Record<string, unknown> }
export type PriceListSlice = {
  id: string
  name: string
  status: string
  starts_at: string | null
  ends_at: string | null
  price_rules?: RuleSlice[]
}

export const volumeRule = (list: Pick<PriceListSlice, 'price_rules'>) => {
  const rule = (list.price_rules ?? []).find((item) => item.type === 'volume_rule')
  if (!rule) return null
  const min = Number(rule.preferences.min_quantity)
  const max = rule.preferences.max_quantity
  return {
    min: Number.isFinite(min) && min > 0 ? min : 1,
    max: typeof max === 'number' && Number.isFinite(max) ? max : null,
  }
}

// Ids of the lists that price at least one of the product's variants.
export const listsPricing = (prices: readonly PriceSlice[]) => [
  ...new Set(prices.flatMap((price) => (price.price_list_id ? [price.price_list_id] : []))),
]

export type TierValues = { id: string | null; minQuantity: string; amount: string }
export type ListPriceRow = {
  variantId: string
  // The list's own price; empty keeps the variant's base price.
  bottomId: string | null
  amount: string
  tiers: TierValues[]
}

const decimal = (value: string | null | undefined) =>
  value != null && /^-?\d+(?:\.\d+)?$/.test(value) ? value : ''

// The editor rows of one list for the given variants, in their order.
export function listPriceRows(
  variantIds: readonly string[],
  prices: readonly PriceSlice[],
  listId: string,
  currency: string,
): ListPriceRow[] {
  const own = prices.filter(
    (price) => price.price_list_id === listId && price.currency === currency,
  )
  return variantIds.map((variantId) => {
    const rungs = own.filter((price) => price.variant_id === variantId)
    const bottom = rungs.find((price) => price.min_quantity <= 1)
    return {
      variantId,
      bottomId: bottom?.id ?? null,
      amount: decimal(bottom?.amount),
      tiers: rungs
        .filter((price) => price.min_quantity > 1)
        .sort((a, b) => a.min_quantity - b.min_quantity)
        .map((price) => ({
          id: price.id,
          minQuantity: String(price.min_quantity),
          amount: decimal(price.amount),
        })),
    }
  })
}

// A summary of what a list charges for the product: the range of its own
// prices and how many quantity breaks it holds.
export function listPriceSummary(rows: readonly ListPriceRow[]) {
  const amounts = rows.map((row) => row.amount).filter((amount) => amount !== '')
  const sorted = [...amounts].sort((a, b) => Number(a) - Number(b))
  return {
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    tiers: rows.reduce((count, row) => count + row.tiers.length, 0),
  }
}

// Canonical decimal strings compare by value ("25000" and "25000.0").
const sameAmount = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : Number(a) === Number(b)

export type ListPriceErrors = Record<string, string>
export const amountErrorKey = (variantId: string) => `${variantId}.amount`
export const tierErrorKey = (variantId: string, index: number, field: 'minQuantity' | 'amount') =>
  `${variantId}.tiers.${index}.${field}`

// Validates the edited rows and works out the writes: rows to upsert (only
// what changed) and quantity breaks to delete. `parseAmount` reads an amount
// as typed in the store's currency, null when it is not one.
export function listPriceChanges(
  initial: readonly ListPriceRow[],
  draft: readonly ListPriceRow[],
  context: {
    listId: string
    currency: string
    parseAmount: (raw: string) => string | null
  },
): { errors: ListPriceErrors; upserts: PriceBulkUpsertRowParams[]; destroyIds: string[] } {
  const errors: ListPriceErrors = {}
  const upserts: PriceBulkUpsertRowParams[] = []
  const destroyIds: string[] = []
  const currency = context.currency as PriceParams['currency']
  const base = { currency, price_list_id: context.listId }
  for (const row of draft) {
    const before = initial.find((item) => item.variantId === row.variantId)
    const amount = row.amount.trim() === '' ? null : context.parseAmount(row.amount)
    const was = before?.amount ? before.amount : null
    if (row.amount.trim() !== '' && amount === null)
      errors[amountErrorKey(row.variantId)] = 'amount'
    else if (!sameAmount(amount, was))
      upserts.push({
        ...(row.bottomId ? { id: row.bottomId } : {}),
        variant_id: row.variantId,
        ...base,
        amount,
      })
    if (row.tiers.length + 1 > MAX_RUNGS) errors[`${row.variantId}.tiers`] = 'tooMany'
    const seen = new Set<number>()
    row.tiers.forEach((tier, index) => {
      const quantity = /^\d{1,7}$/.test(tier.minQuantity.trim()) ? Number(tier.minQuantity) : NaN
      if (!(quantity >= 2 && quantity <= MAX_QUANTITY))
        errors[tierErrorKey(row.variantId, index, 'minQuantity')] = 'quantity'
      else if (seen.has(quantity))
        errors[tierErrorKey(row.variantId, index, 'minQuantity')] = 'duplicate'
      seen.add(quantity)
      const tierAmount = context.parseAmount(tier.amount)
      if (tierAmount === null) errors[tierErrorKey(row.variantId, index, 'amount')] = 'amount'
      if (Number.isNaN(quantity) || tierAmount === null) return
      const stored = before?.tiers.find((item) => item.id !== null && item.id === tier.id)
      if (
        stored &&
        stored.minQuantity === String(quantity) &&
        sameAmount(stored.amount, tierAmount)
      )
        return
      upserts.push({
        ...(tier.id ? { id: tier.id } : {}),
        variant_id: row.variantId,
        ...base,
        min_quantity: quantity,
        amount: tierAmount,
      })
    })
    const keptIds = new Set(row.tiers.map((tier) => tier.id).filter(Boolean))
    for (const tier of before?.tiers ?? [])
      if (tier.id && !keptIds.has(tier.id)) destroyIds.push(tier.id)
  }
  return Object.keys(errors).length > 0
    ? { errors, upserts: [], destroyIds: [] }
    : { errors, upserts, destroyIds }
}
