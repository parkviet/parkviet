import { describe, expect, it } from 'vitest'
import { parseAmount } from '../schemas/goods-product'
import {
  listPriceChanges,
  listPriceRows,
  listPriceSummary,
  listsPricing,
  volumeRule,
} from './goods-price-lists'

const price = (
  id: string,
  variant: string,
  list: string | null,
  amount: string | null,
  min = 1,
) => ({
  id,
  variant_id: variant,
  price_list_id: list,
  currency: 'VND',
  amount,
  min_quantity: min,
})
const prices = [
  price('p1', 'v1', 'pl_sale', '20000'),
  price('p2', 'v1', 'pl_sale', '18000', 10),
  price('p3', 'v2', 'pl_sale', null),
  price('p4', 'v1', 'pl_other', '19000'),
]
const context = { listId: 'pl_sale', currency: 'VND', parseAmount: parseAmount('VND') }

describe('price list reads', () => {
  it('finds the lists pricing the product and its rows in one list', () => {
    expect(listsPricing(prices)).toEqual(['pl_sale', 'pl_other'])
    const rows = listPriceRows(['v1', 'v2'], prices, 'pl_sale', 'VND')
    expect(rows).toEqual([
      {
        variantId: 'v1',
        bottomId: 'p1',
        amount: '20000',
        tiers: [{ id: 'p2', minQuantity: '10', amount: '18000' }],
      },
      { variantId: 'v2', bottomId: 'p3', amount: '', tiers: [] },
    ])
    expect(listPriceSummary(rows)).toEqual({ min: '20000', max: '20000', tiers: 1 })
  })

  it('reads the volume rule range', () => {
    expect(volumeRule({ price_rules: [] })).toBeNull()
    expect(
      volumeRule({
        price_rules: [
          { type: 'volume_rule', preferences: { min_quantity: 5, max_quantity: null } },
        ],
      }),
    ).toEqual({ min: 5, max: null })
  })
})

describe('listPriceChanges', () => {
  const initial = listPriceRows(['v1', 'v2'], prices, 'pl_sale', 'VND')

  it('sends only what changed and deletes removed quantity breaks', () => {
    const draft = [
      {
        ...initial[0],
        amount: '21.000',
        tiers: [{ id: null, minQuantity: '20', amount: '17000' }],
      },
      { ...initial[1] },
    ]
    expect(listPriceChanges(initial, draft, context)).toEqual({
      errors: {},
      upserts: [
        { id: 'p1', variant_id: 'v1', currency: 'VND', price_list_id: 'pl_sale', amount: '21000' },
        {
          variant_id: 'v1',
          currency: 'VND',
          price_list_id: 'pl_sale',
          min_quantity: 20,
          amount: '17000',
        },
      ],
      destroyIds: ['p2'],
    })
  })

  it('changes nothing for an untouched list and clears a price back to the base one', () => {
    expect(listPriceChanges(initial, initial, context).upserts).toEqual([])
    const cleared = listPriceChanges(initial, [{ ...initial[0], amount: '' }, initial[1]], context)
    expect(cleared.upserts).toEqual([
      { id: 'p1', variant_id: 'v1', currency: 'VND', price_list_id: 'pl_sale', amount: null },
    ])
  })

  it('refuses invalid amounts and quantities without writing anything', () => {
    const draft = [
      {
        ...initial[0],
        amount: 'abc',
        tiers: [
          { id: 'p2', minQuantity: '1', amount: '18000' },
          { id: null, minQuantity: '5', amount: '' },
          { id: null, minQuantity: '5', amount: '15000' },
        ],
      },
      initial[1],
    ]
    const result = listPriceChanges(initial, draft, context)
    expect(result.errors).toEqual({
      'v1.amount': 'amount',
      'v1.tiers.0.minQuantity': 'quantity',
      'v1.tiers.1.amount': 'amount',
      'v1.tiers.2.minQuantity': 'duplicate',
    })
    expect(result.upserts).toEqual([])
    expect(result.destroyIds).toEqual([])
  })
})
