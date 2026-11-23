import { MAX_LABEL_COPIES, MAX_LABEL_ITEMS } from '../hooks/use-product-label-data'

// The barcode label screen's pick list: variants sold at the selected branch,
// each with the number of labels to print. A count of 0 keeps the row on
// screen but leaves it out of the print.

export type LabelPick = {
  variantId: string
  productId: string
  name: string
  sku: string
  barcode: string | null
  // The branch's POS channel price of one unit, the amount the label prints.
  channelPrice: string | null
  // On hand at the branch's stock location; null when no stock is kept.
  stock: number | null
  count: number
}

export type PickSource = {
  id: string
  product_id: string
  name: string
  sku: string
  barcode: string | null
  price: string | null
  stock_on_hand: number | null
}

export const clampCount = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_LABEL_COPIES, Math.max(0, Math.floor(value))) : 0

export type AddResult = { picks: LabelPick[]; outcome: 'added' | 'incremented' | 'full' }

// A variant already picked gets one more label instead of a second row, so
// scanning the same code twice asks for two labels.
export function addPick(picks: readonly LabelPick[], source: PickSource): AddResult {
  const index = picks.findIndex((pick) => pick.variantId === source.id)
  if (index >= 0) {
    const next = [...picks]
    const current = next[index] as LabelPick
    next[index] = { ...current, count: clampCount(current.count + 1) }
    return { picks: next, outcome: 'incremented' }
  }
  if (picks.length >= MAX_LABEL_ITEMS) return { picks: [...picks], outcome: 'full' }
  return {
    picks: [
      ...picks,
      {
        variantId: source.id,
        productId: source.product_id,
        name: source.name,
        sku: source.sku,
        barcode: source.barcode,
        channelPrice: source.price,
        stock: source.stock_on_hand,
        count: 1,
      },
    ],
    outcome: 'added',
  }
}

export const setPickCount = (picks: readonly LabelPick[], variantId: string, count: number) =>
  picks.map((pick) => (pick.variantId === variantId ? { ...pick, count: clampCount(count) } : pick))

export const applyCountToAll = (picks: readonly LabelPick[], count: number) =>
  picks.map((pick) => ({ ...pick, count: clampCount(count) }))

// One label per unit on hand. Negative stock asks for none; a variant whose
// stock is not kept keeps the count it has.
export const countsFromStock = (picks: readonly LabelPick[]) =>
  picks.map((pick) => (pick.stock === null ? pick : { ...pick, count: clampCount(pick.stock) }))

// What the print dialog receives: picked variants with at least one label.
export const printItems = (picks: readonly LabelPick[]) =>
  picks
    .filter((pick) => pick.count > 0)
    .map((pick) => ({ variantId: pick.variantId, quantity: pick.count }))

export const totalLabels = (picks: readonly LabelPick[]) =>
  picks.reduce((sum, pick) => sum + pick.count, 0)

export type BasePriceRow = {
  variant_id: string | null
  amount: string | null
  min_quantity?: number | null
}

// A variant's own (base) price, the one a price list does not set. A base
// price with a quantity break above one is not the price of one unit.
export function basePriceByVariant(rows: readonly BasePriceRow[]) {
  const prices = new Map<string, string>()
  for (const row of rows)
    if (
      row.variant_id !== null &&
      row.amount !== null &&
      (row.min_quantity ?? 1) <= 1 &&
      !prices.has(row.variant_id)
    )
      prices.set(row.variant_id, row.amount)
  return prices
}

const amountValue = (amount: string | null | undefined) => {
  if (amount == null || amount.trim() === '') return null
  const value = Number(amount)
  return Number.isFinite(value) ? value : null
}

// The selling price shown is the variant's own price; when a price list on
// the POS channel changes what the till charges, that price is the promotional
// one. Without a known own price, the channel price is the selling price.
export function labelPrices(base: string | null | undefined, channel: string | null) {
  const own = amountValue(base)
  const charged = amountValue(channel)
  if (own === null) return { price: charged === null ? null : channel, promo: null }
  return { price: base as string, promo: charged !== null && charged !== own ? channel : null }
}
