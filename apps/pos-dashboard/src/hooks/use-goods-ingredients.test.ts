import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyIngredient } from '../lib/goods-ingredients'
import { goodsIngredientSchema } from '../schemas/goods-ingredient'

const sdk = vi.hoisted(() => ({
  products: { create: vi.fn(), update: vi.fn() },
  variants: { list: vi.fn() },
}))
const request = vi.hoisted(() => vi.fn())
vi.mock('@spree/dashboard-core', () => ({
  adminClient: sdk,
  usePermissions: vi.fn(),
  useResourceMutation: vi.fn(),
}))
vi.mock('../lib/pos-request', () => ({ posRequest: request }))

const { saveIngredient } = await import('./use-goods-ingredients')

const types = { goods: 'pt_goods', service: 'pt_service', ingredient: 'pt_ingredient' }
const parsed = (values: Record<string, unknown> = {}) =>
  goodsIngredientSchema('VND').parse({ ...emptyIngredient('g'), name: 'Bột mì', ...values })
const context = (overrides: Record<string, unknown> = {}) => ({
  currency: 'VND',
  ensureProductTypes: vi.fn(async () => types),
  locationIds: ['sloc_a'],
  alertBranchId: 'branch_a',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  sdk.variants.list.mockResolvedValue({ data: [] })
  sdk.products.create.mockResolvedValue({ id: 'prod_new', default_variant_id: 'variant_new' })
  sdk.products.update.mockResolvedValue({ id: 'prod_old', default_variant_id: 'variant_old' })
  request.mockResolvedValue({ data: {} })
})

describe('saveIngredient', () => {
  it('creates with a generated NL code, then sets the stock unit and threshold', async () => {
    sdk.variants.list.mockResolvedValueOnce({ data: [{ sku: 'NL000007' }] })
    const outcome = await saveIngredient(parsed({ alert: '300' }), context())
    expect(sdk.variants.list).toHaveBeenNthCalledWith(1, {
      sku_start: 'NL',
      sort: '-sku',
      limit: 100,
    })
    expect(sdk.products.create.mock.calls[0][0]).toMatchObject({
      product_type_id: 'pt_ingredient',
      variants: [{ sku: 'NL000008' }],
    })
    expect(request).toHaveBeenCalledWith('PUT', '/pos/units/variant', {
      body: { variant_id: 'variant_new', sale_unit: 'g' },
    })
    expect(request).toHaveBeenCalledWith(
      'PUT',
      '/pos/stock_alerts',
      expect.objectContaining({
        body: { branch_id: 'branch_a', variant_id: 'variant_new', min_quantity: 300 },
      }),
    )
    expect(outcome).toEqual({
      stored: { productId: 'prod_new', variantId: 'variant_new', unitCode: 'g', alert: 300 },
      failures: [],
    })
  })

  it('reports a refused unit and keeps what was saved, so a retry patches', async () => {
    const refusal = { status: 409, details: { reason: 'stock_unit_in_use' } }
    request.mockRejectedValueOnce(refusal)
    const first = await saveIngredient(
      parsed({ sku: 'NL000001' }),
      context({ alertBranchId: null }),
    )
    expect(first.failures).toEqual([{ step: 'unit', error: refusal }])
    expect(first.stored.unitCode).toBe('item')

    await saveIngredient(parsed({ sku: 'NL000001' }), context({ existing: first.stored }))
    expect(sdk.products.create).toHaveBeenCalledTimes(1)
    expect(sdk.products.update).toHaveBeenCalledWith('prod_new', {
      name: 'Bột mì',
      variants: [{ id: 'variant_new', sku: 'NL000001', cost_price: null }],
    })
  })

  it('writes only what changed on an edit and clears a threshold set back to none', async () => {
    const existing = { productId: 'prod_old', variantId: 'variant_old', unitCode: 'g', alert: 50 }
    const outcome = await saveIngredient(parsed({ sku: 'NL000003' }), context({ existing }))
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][2].body).toEqual({
      branch_id: 'branch_a',
      variant_id: 'variant_old',
      min_quantity: null,
    })
    expect(outcome.stored.alert).toBeNull()
  })

  it('throws a refusal of the product itself untouched', async () => {
    const invalid = { status: 422, details: { name: ['has already been taken'] } }
    sdk.products.create.mockRejectedValueOnce(invalid)
    await expect(saveIngredient(parsed({ sku: 'NL000001' }), context())).rejects.toBe(invalid)
    expect(request).not.toHaveBeenCalled()
  })
})
