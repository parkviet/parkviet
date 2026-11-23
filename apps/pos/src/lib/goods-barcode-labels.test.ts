import { describe, expect, it } from 'vitest'
import { MAX_LABEL_COPIES, MAX_LABEL_ITEMS } from '../hooks/use-product-label-data'
import {
  addPick,
  applyCountToAll,
  basePriceByVariant,
  clampCount,
  countsFromStock,
  type LabelPick,
  labelPrices,
  type PickSource,
  printItems,
  setPickCount,
  totalLabels,
} from './goods-barcode-labels'

const source = (id: string, patch: Partial<PickSource> = {}): PickSource => ({
  id,
  product_id: `prod_${id}`,
  name: `Hàng ${id}`,
  sku: `SKU-${id}`,
  barcode: null,
  price: '10000',
  stock_on_hand: 5,
  ...patch,
})
const picked = (...sources: PickSource[]) =>
  sources.reduce<LabelPick[]>((picks, row) => addPick(picks, row).picks, [])

describe('picking goods', () => {
  it('adds a variant once and counts a repeated scan as one more label', () => {
    const first = addPick([], source('a'))
    expect(first.outcome).toBe('added')
    expect(first.picks).toMatchObject([
      { variantId: 'a', productId: 'prod_a', channelPrice: '10000', stock: 5, count: 1 },
    ])
    const again = addPick(first.picks, source('a'))
    expect(again.outcome).toBe('incremented')
    expect(again.picks).toHaveLength(1)
    expect(again.picks[0]?.count).toBe(2)
  })

  it('refuses a new row past the server limit but still counts a picked one', () => {
    const full = Array.from({ length: MAX_LABEL_ITEMS }, (_, index) => source(`v${index}`)).reduce<
      LabelPick[]
    >((picks, row) => addPick(picks, row).picks, [])
    expect(addPick(full, source('extra')).outcome).toBe('full')
    expect(addPick(full, source('extra')).picks).toHaveLength(MAX_LABEL_ITEMS)
    expect(addPick(full, source('v0')).outcome).toBe('incremented')
  })

  it('clamps counts to whole labels between 0 and the copy limit', () => {
    expect(clampCount(-3)).toBe(0)
    expect(clampCount(2.7)).toBe(2)
    expect(clampCount(Number.NaN)).toBe(0)
    expect(clampCount(MAX_LABEL_COPIES + 5)).toBe(MAX_LABEL_COPIES)
    const picks = picked(source('a'), source('b'))
    expect(setPickCount(picks, 'b', 4).map((pick) => pick.count)).toEqual([1, 4])
  })

  it('applies one count to every row', () => {
    const picks = applyCountToAll(picked(source('a'), source('b')), 3)
    expect(picks.map((pick) => pick.count)).toEqual([3, 3])
    expect(totalLabels(picks)).toBe(6)
  })

  it('sets counts from stock, none for negative stock, unchanged without stock', () => {
    const picks = countsFromStock(
      picked(
        source('a', { stock_on_hand: 12 }),
        source('b', { stock_on_hand: -4 }),
        source('c', { stock_on_hand: null }),
        source('d', { stock_on_hand: 5000 }),
      ),
    )
    expect(picks.map((pick) => pick.count)).toEqual([12, 0, 1, MAX_LABEL_COPIES])
  })

  it('prints only rows with labels', () => {
    const picks = setPickCount(picked(source('a'), source('b')), 'a', 0)
    expect(printItems(picks)).toEqual([{ variantId: 'b', quantity: 1 }])
  })
})

describe('prices', () => {
  it('keeps the base price of one unit per variant', () => {
    const prices = basePriceByVariant([
      { variant_id: 'a', amount: '9000', min_quantity: 10 },
      { variant_id: 'a', amount: '10000', min_quantity: 1 },
      { variant_id: 'b', amount: null, min_quantity: 1 },
      { variant_id: null, amount: '1', min_quantity: 1 },
    ])
    expect([...prices]).toEqual([['a', '10000']])
  })

  it('shows the channel price as promotional only when a price list changes it', () => {
    expect(labelPrices('10000', '10000.0')).toEqual({ price: '10000', promo: null })
    expect(labelPrices('10000', '8500')).toEqual({ price: '10000', promo: '8500' })
    expect(labelPrices(undefined, '8500')).toEqual({ price: '8500', promo: null })
    expect(labelPrices('10000', null)).toEqual({ price: '10000', promo: null })
    expect(labelPrices(null, null)).toEqual({ price: null, promo: null })
  })
})
