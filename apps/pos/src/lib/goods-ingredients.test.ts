import { describe, expect, it } from 'vitest'
import { goodsIngredientSchema } from '../schemas/goods-ingredient'
import {
  emptyIngredient,
  type IngredientProductSlice,
  ingredientCells,
  ingredientCreateBody,
  ingredientRow,
  ingredientUpdateBody,
  multiplyDecimal,
  stockState,
} from './goods-ingredients'
import { nextSku } from './goods-products'

const product = (extra: Partial<IngredientProductSlice> = {}): IngredientProductSlice => ({
  id: 'prod_flour',
  name: 'Bột mì',
  status: 'active',
  default_variant_id: 'variant_flour',
  variants: [
    {
      id: 'variant_flour',
      sku: 'NL000001',
      cost_price: '12.5',
      stock_levels: [
        { stock_location_id: 'sloc_a', count_on_hand: 400 },
        { stock_location_id: 'sloc_b', count_on_hand: -3 },
      ],
    },
  ],
  ...extra,
})
const context = (locationId: string | null, alert: number | null = null) => ({
  locationId,
  unitOf: () => ({ code: 'g', name: 'Gram' }),
  alertOf: () => alert,
})

describe('multiplyDecimal', () => {
  it('multiplies exactly, keeping signs and dropping trailing zeros', () => {
    expect(multiplyDecimal('12.5', 400)).toBe('5000')
    expect(multiplyDecimal('12000', 3)).toBe('36000')
    expect(multiplyDecimal('0.15', 3)).toBe('0.45')
    expect(multiplyDecimal('12.5', -3)).toBe('-37.5')
    expect(multiplyDecimal('12.5', 0)).toBe('0')
  })
})

describe('stockState', () => {
  it('is out at zero or below, low under the threshold and in stock otherwise', () => {
    expect(stockState(0, null)).toBe('out')
    expect(stockState(-2, 5)).toBe('out')
    expect(stockState(4, 5)).toBe('low')
    expect(stockState(5, 5)).toBe('in_stock')
    expect(stockState(1, null)).toBe('in_stock')
  })
})

describe('ingredientRow', () => {
  it('reads stock at the selected location, its value and the threshold', () => {
    expect(ingredientRow(product(), context('sloc_a', 500))).toMatchObject({
      sku: 'NL000001',
      unit_code: 'g',
      on_hand: 400,
      value: '5000',
      stock_state: 'low',
      negative: false,
      alert: 500,
      business: 'active',
    })
  })

  it('flags negative stock and has no value without a cost', () => {
    const variants = [{ ...product().variants![0], cost_price: null }]
    const row = ingredientRow(product({ variants, status: 'archived' }), context('sloc_b'))
    expect(row).toMatchObject({ on_hand: -3, negative: true, stock_state: 'out', value: null })
    expect(row.business).toBe('inactive')
    expect(ingredientRow(product(), context(null)).on_hand).toBe(0)
  })

  it('shows unset thresholds and missing costs as text', () => {
    const cells = ingredientCells(ingredientRow(product(), context('sloc_a')), {
      currency: 'VND',
      stockLabel: (state) => state,
      businessLabel: (state) => state,
      noAlert: 'Chưa đặt',
    })
    expect(cells.alert).toBe('Chưa đặt')
    expect(cells.unit).toBe('Gram')
    expect(cells.stock_state).toBe('in_stock')
  })
})

describe('ingredient bodies', () => {
  const parse = (values: Record<string, unknown>) =>
    goodsIngredientSchema('VND').parse({ ...emptyIngredient('g'), name: 'Bột mì', ...values })

  it('creates a tracked product on no channel with an opening count per location', () => {
    const body = ingredientCreateBody(
      parse({ sku: 'NL000002', costPrice: '12.000', openingStock: { sloc_a: '500' } }),
      {
        currency: 'VND',
        productTypeId: 'pt_ingredient',
        locationIds: ['sloc_a', 'sloc_b', 'sloc_a'],
      },
    )
    expect(body).toEqual({
      name: 'Bột mì',
      status: 'active',
      product_type_id: 'pt_ingredient',
      variants: [
        {
          sku: 'NL000002',
          cost_price: '12000',
          cost_currency: 'VND',
          track_inventory: true,
          stock_levels: [
            { stock_location_id: 'sloc_a', count_on_hand: 500 },
            { stock_location_id: 'sloc_b', count_on_hand: 0 },
          ],
        },
      ],
    })
    expect(body).not.toHaveProperty('product_publications')
    expect(body).not.toHaveProperty('prices')
  })

  it('edits without stock levels', () => {
    const body = ingredientUpdateBody(parse({ sku: 'NL000002' }), {
      currency: 'VND',
      variantId: 'variant_flour',
    })
    expect(body).toEqual({
      name: 'Bột mì',
      variants: [{ id: 'variant_flour', sku: 'NL000002', cost_price: null }],
    })
  })
})

describe('goodsIngredientSchema', () => {
  const schema = goodsIngredientSchema('VND')
  it('needs a name and a unit and reads 0 as no threshold', () => {
    const failed = schema.safeParse({ ...emptyIngredient(''), alert: '1.5' })
    expect(failed.success).toBe(false)
    expect(failed.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'name',
      'unitCode',
      'alert',
    ])
    const parsed = schema.parse({ ...emptyIngredient('g'), name: ' Đường ', alert: '0' })
    expect(parsed).toMatchObject({ name: 'Đường', alert: null, costPrice: null })
    expect(schema.parse({ ...emptyIngredient('g'), name: 'Đường', alert: '200' }).alert).toBe(200)
  })

  it('refuses a negative or fractional opening count', () => {
    const result = schema.safeParse({
      ...emptyIngredient('g'),
      name: 'Đường',
      openingStock: { sloc_a: '-1' },
    })
    expect(result.error?.issues[0].path).toEqual(['openingStock', 'sloc_a'])
  })
})

describe('nextSku with a prefix', () => {
  it('numbers ingredients apart from products', () => {
    expect(nextSku(['SP000009', 'NL000004'], 'NL')).toBe('NL000005')
    expect(nextSku(['SP000009'], 'NL')).toBe('NL000001')
  })
})
