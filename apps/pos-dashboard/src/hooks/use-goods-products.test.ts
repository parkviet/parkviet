import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyGoodsProduct } from '../lib/goods-products'
import { syncVariantRows } from '../lib/goods-variants'
import { goodsProductSchema } from '../schemas/goods-product'

const sdk = vi.hoisted(() => ({
  products: {
    create: vi.fn(),
    update: vi.fn(),
    bulkAddToChannels: vi.fn(),
    media: { create: vi.fn(), delete: vi.fn() },
    variants: { create: vi.fn(), delete: vi.fn() },
  },
  variants: { list: vi.fn() },
  optionTypes: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
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
  sdk.optionTypes.list.mockResolvedValue({ data: [], meta: { next: null } })
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

describe('saveGoodsProduct with attributes and add-on groups', () => {
  const attributes = [{ name: 'Size', values: ['M', 'L'] }]
  const rows = syncVariantRows(attributes, [], [], { price: '30000', costPrice: '' })

  it('creates the option type, names every variant and gives the menu item its groups', async () => {
    sdk.variants.list
      .mockResolvedValueOnce({ data: [{ sku: 'SP000004' }] })
      .mockResolvedValue({ data: [] })
    const outcome = await saveGoodsProduct(
      parsed({ attributes, variants: rows, unitCode: 'item', modifierGroupIds: ['grp_topping'] }),
      context({ addons: { menuItem: null } }),
    )
    expect(outcome.failures).toEqual([])
    expect(sdk.optionTypes.create).toHaveBeenCalledWith({
      name: 'size',
      label: 'Size',
      option_values: [
        { name: 'm', label: 'M', position: 1 },
        { name: 'l', label: 'L', position: 2 },
      ],
    })
    const body = sdk.products.create.mock.calls[0][0]
    expect(body).not.toHaveProperty('prices')
    expect(
      body.variants.map((row: { sku: string; options: unknown }) => [row.sku, row.options]),
    ).toEqual([
      ['SP000005', [{ name: 'size', value: 'm' }]],
      ['SP000006', [{ name: 'size', value: 'l' }]],
    ])
    const menu = request.mock.calls.find(([, path]) => path === '/pos/menu_items')
    expect(menu?.[0]).toBe('POST')
    expect(menu?.[2]).toMatchObject({
      body: { product_id: 'prod_new', kind: 'single', modifier_group_ids: ['grp_topping'] },
      idempotencyKey: expect.any(String),
    })
    // A product with variants keeps its unit to the per-variant editor.
    expect(request.mock.calls.some(([, path]) => path === '/pos/units/variant')).toBe(false)
  })

  it('on an edit deletes removed variants, creates new ones and reports a refused delete', async () => {
    const stored = {
      ...created,
      default_variant_id: 'v_m',
      metadata: {},
      media: [],
      channels: [{ code: 'pos' }],
      variants: [
        { id: 'v_m', options_text: 'Size: M' },
        { id: 'v_s', options_text: 'Size: S' },
      ],
    }
    sdk.optionTypes.list.mockResolvedValue({
      data: [
        {
          id: 'ot_size',
          name: 'size',
          label: 'Size',
          option_values: [{ id: 'ov_m', name: 'm', label: 'M', position: 1 }],
        },
      ],
      meta: { next: null },
    })
    const inUse = Object.assign(new Error('Variant has orders'), { status: 422 })
    sdk.products.variants.delete.mockRejectedValueOnce(inUse)
    const edited = rows.map((row) =>
      row.values[0] === 'M' ? { ...row, variantId: 'v_m', sku: 'A-M' } : { ...row, sku: 'A-L' },
    )
    const outcome = await saveGoodsProduct(
      parsed({ attributes, variants: edited, modifierGroupIds: ['grp_a'] }),
      context({
        existing: { product: stored, branchIds: ['branch_a', 'branch_b'], unitCode: 'ly' } as never,
        addons: { menuItem: { id: 'mi_1', kind: 'single', modifierGroupIds: ['grp_a'] } },
      }),
    )
    expect(sdk.optionTypes.update).toHaveBeenCalledWith('ot_size', {
      option_values: [
        { id: 'ov_m', name: 'm', label: 'M', position: 1 },
        { name: 'l', label: 'L', position: 2 },
      ],
    })
    // The variant to delete rides along, so the update does not remove it
    // and its refusal is reported by the delete below.
    expect(sdk.products.update.mock.calls[0][1].variants).toEqual([
      expect.objectContaining({ id: 'v_m', sku: 'A-M' }),
      { id: 'v_s' },
    ])
    expect(sdk.products.variants.delete).toHaveBeenCalledWith('prod_new', 'v_s')
    expect(sdk.products.variants.create).toHaveBeenCalledWith(
      'prod_new',
      expect.objectContaining({ sku: 'A-L', options: [{ name: 'size', value: 'l' }] }),
    )
    expect(outcome.failures).toEqual([{ step: 'variantDelete', error: inUse, label: 'Size: S' }])
    expect(outcome.failures[0].error).toBe(inUse)
    // Unchanged groups are not written again.
    expect(request.mock.calls.some(([, path]) => String(path).startsWith('/pos/menu_items'))).toBe(
      false,
    )
  })
  it('takes a variant already gone as removed', async () => {
    const stored = {
      ...created,
      default_variant_id: 'v_m',
      metadata: {},
      media: [],
      channels: [{ code: 'pos' }],
      variants: [
        { id: 'v_m', options_text: 'Size: M' },
        { id: 'v_s', options_text: 'Size: S' },
      ],
    }
    sdk.optionTypes.list.mockResolvedValue({
      data: [
        {
          id: 'ot_size',
          name: 'size',
          label: 'Size',
          option_values: [{ id: 'ov_m', name: 'm', label: 'M', position: 1 }],
        },
      ],
      meta: { next: null },
    })
    sdk.products.variants.delete.mockRejectedValueOnce(
      Object.assign(new Error('Not found'), { status: 404 }),
    )
    const outcome = await saveGoodsProduct(
      parsed({
        attributes,
        variants: rows
          .filter((row) => row.values[0] === 'M')
          .map((row) => ({ ...row, variantId: 'v_m', sku: 'A-M' })),
      }),
      context({
        existing: { product: stored, branchIds: ['branch_a', 'branch_b'], unitCode: 'ly' } as never,
      }),
    )
    expect(sdk.products.variants.delete).toHaveBeenCalledWith('prod_new', 'v_s')
    expect(outcome.failures).toEqual([])
  })
})
