import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyGoodsProduct } from '../lib/goods-products'
import { goodsProductSchema } from '../schemas/goods-product'

const sdk = vi.hoisted(() => ({
  products: {
    create: vi.fn(),
    update: vi.fn(),
    bulkAddToChannels: vi.fn(),
    media: { create: vi.fn(), delete: vi.fn() },
  },
  variants: { list: vi.fn() },
  files: { upload: vi.fn() },
}))
const request = vi.hoisted(() => vi.fn())
vi.mock('@spree/dashboard-core', () => ({
  adminClient: sdk,
  usePermissions: vi.fn(),
  useResourceMutation: vi.fn(),
}))
vi.mock('../lib/pos-request', () => ({ posRequest: request }))

const { generateSku, saveGoodsProduct } = await import('./use-goods-products')

const types = { goods: 'pt_goods', service: 'pt_service', ingredient: 'pt_ingredient' }
const parsed = (overrides: Record<string, unknown> = {}) =>
  goodsProductSchema('VND').parse({
    ...emptyGoodsProduct(['branch_a', 'branch_b']),
    name: 'Trà đào',
    price: '25000',
    unitCode: 'ly',
    ...overrides,
  })
const created = { id: 'prod_new', default_variant_id: 'variant_new', variants: [], channels: [] }
const context = (overrides: Record<string, unknown> = {}) => ({
  currency: 'VND',
  ensurePosChannel: vi.fn(async () => ({ id: 'ch_pos' })),
  ensureProductTypes: vi.fn(async () => types),
  stockLocations: { branch_a: 'sloc_a', branch_b: 'sloc_b' },
  manageBranches: true,
  image: null,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  sdk.variants.list.mockResolvedValue({ data: [] })
  sdk.products.create.mockResolvedValue(created)
  sdk.products.update.mockResolvedValue(created)
  request.mockResolvedValue({ data: {} })
})

describe('generateSku', () => {
  it('skips a candidate that another product already took', async () => {
    sdk.variants.list
      .mockResolvedValueOnce({ data: [{ sku: 'SP000004' }] })
      .mockResolvedValueOnce({ data: [{ sku: 'SP000005' }] })
      .mockResolvedValueOnce({ data: [] })
    await expect(generateSku()).resolves.toBe('SP000006')
    expect(sdk.variants.list).toHaveBeenNthCalledWith(1, {
      sku_start: 'SP',
      sort: '-sku',
      limit: 100,
    })
  })
})

describe('saveGoodsProduct', () => {
  it('creates on the pos channel, assigns branches and sets the unit through one of them', async () => {
    const outcome = await saveGoodsProduct(parsed(), context())
    expect(outcome).toEqual({ productId: 'prod_new', failures: [] })
    expect(sdk.products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_type_id: 'pt_goods',
        product_publications: [{ channel_id: 'ch_pos' }],
        variants: [expect.objectContaining({ sku: 'SP000001' })],
      }),
    )
    expect(request.mock.calls.map(([method, path]) => `${method} ${path}`)).toEqual([
      'POST /pos/branches/branch_a/products',
      'POST /pos/branches/branch_b/products',
      'PUT /pos/units/variant',
    ])
    expect(request.mock.calls[2][2].body).toMatchObject({
      branch_id: 'branch_a',
      variant_id: 'variant_new',
      sale_unit: 'ly',
    })
  })

  it('keeps the created product when a branch refuses and reports that step', async () => {
    const refusal = Object.assign(new Error('Forbidden'), { status: 403 })
    request.mockRejectedValueOnce(refusal)
    const outcome = await saveGoodsProduct(parsed({ unitCode: 'item' }), context())
    expect(outcome).toEqual({
      productId: 'prod_new',
      failures: [{ step: 'branches', error: refusal }],
    })
    expect(sdk.products.create).toHaveBeenCalledTimes(1)
  })

  it('throws a refusal of the product itself untouched for the form', async () => {
    const invalid = Object.assign(new Error('Invalid'), { status: 422 })
    sdk.products.create.mockRejectedValueOnce(invalid)
    await expect(saveGoodsProduct(parsed(), context())).rejects.toBe(invalid)
    expect(request).not.toHaveBeenCalled()
  })

  it('on a retry edits the product and repeats only the missing assignments', async () => {
    const existing = {
      product: { ...created, metadata: {}, channels: [{ code: 'pos' }], media: [] },
      branchIds: ['branch_a'],
      unitCode: 'ly',
    }
    await saveGoodsProduct(parsed({ sku: 'SP000001' }), context({ existing: existing as never }))
    expect(sdk.products.create).not.toHaveBeenCalled()
    expect(sdk.products.update).toHaveBeenCalledWith(
      'prod_new',
      expect.not.objectContaining({ product_publications: expect.anything() }),
    )
    expect(request.mock.calls.map(([method, path]) => `${method} ${path}`)).toEqual([
      'POST /pos/branches/branch_b/products',
    ])
  })

  it('publishes a catalog product on pos before a branch may sell it', async () => {
    const existing = {
      product: { ...created, metadata: {}, channels: [{ code: 'online' }], media: [] },
      branchIds: [],
      unitCode: 'item',
    }
    await saveGoodsProduct(
      parsed({ sku: 'X1', unitCode: 'item', branchIds: ['branch_a'] }),
      context({ existing: existing as never }),
    )
    expect(sdk.products.bulkAddToChannels).toHaveBeenCalledWith({
      ids: ['prod_new'],
      channel_ids: ['ch_pos'],
    })
    expect(request).toHaveBeenCalledWith('POST', '/pos/branches/branch_a/products', {
      body: { product_id: 'prod_new' },
    })
  })

  it('leaves branches alone for staff who cannot manage them', async () => {
    await saveGoodsProduct(parsed(), context({ manageBranches: false }))
    expect(request).not.toHaveBeenCalled()
  })
})
