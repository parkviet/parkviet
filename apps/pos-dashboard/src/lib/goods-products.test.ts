import { describe, expect, it } from 'vitest'
import { goodsProductSchema } from '../schemas/goods-product'
import {
  branchChanges,
  emptyGoodsProduct,
  formFromProduct,
  type GoodsCellContext,
  goodsCells,
  imageProblem,
  nextSku,
  type ProductSlice,
  priceRange,
  productCreateBody,
  productStock,
  productUpdateBody,
  toCsv,
  type VariantSlice,
} from './goods-products'
import { syncVariantRows } from './goods-variants'

const variant = (overrides: Partial<VariantSlice> = {}): VariantSlice => ({
  id: 'variant_1',
  sku: 'SP000001',
  barcode: '8930001',
  cost_price: '12000',
  track_inventory: true,
  options_text: '',
  price: { amount: '25000' },
  stock_levels: [],
  ...overrides,
})
const product = (overrides: Partial<ProductSlice> = {}): ProductSlice => ({
  id: 'prod_1',
  name: 'Cà phê sữa',
  status: 'active',
  in_stock: true,
  default_variant_id: 'variant_1',
  price: { amount: '25000' },
  product_type_id: 'pt_goods',
  tax_category_id: 'taxcat_vat',
  total_on_hand: 99,
  variants: [variant()],
  ...overrides,
})
const sized = product({
  default_variant_id: 'variant_master',
  variants: [
    variant({ id: 'variant_s', sku: 'CF-S', options_text: 'Size: S', price: { amount: '20000' } }),
    variant({ id: 'variant_l', sku: 'CF-L', options_text: 'Size: L', price: { amount: '35000' } }),
  ],
})

describe('list rows', () => {
  it('ranges the price over option variants and keeps a simple price single', () => {
    expect(priceRange(sized)).toEqual({ min: '20000', max: '35000' })
    expect(priceRange(product())).toEqual({ min: '25000', max: '25000' })
    expect(priceRange(product({ price: null }))).toBeNull()
  })

  it('sums stock at the branch locations only and keeps a negative count', () => {
    const levels = [
      { stock_location_id: 'sloc_a', count_on_hand: 4 },
      { stock_location_id: 'sloc_b', count_on_hand: -7 },
      { stock_location_id: 'sloc_web', count_on_hand: 100 },
    ]
    const row = product({ variants: [variant({ stock_levels: levels })] })
    expect(productStock(row, ['sloc_a', 'sloc_b'])).toEqual({ tracked: true, onHand: -3 })
    // Without the branch list, Spree's own total stands in.
    expect(productStock(row, null)).toEqual({ tracked: true, onHand: 99 })
  })

  it('shows untracked items as available or sold out instead of a count', () => {
    const untracked = product({ in_stock: false, variants: [variant({ track_inventory: false })] })
    expect(productStock(untracked, ['sloc_a'])).toEqual({ tracked: false, inStock: false })
  })

  it('renders every column as text for the table and the export', () => {
    const context: GoodsCellContext = {
      currency: 'VND',
      locationIds: [],
      unitName: () => 'Ly',
      taxLabel: (id) => (id ? 'VAT (8%)' : '—'),
      typeName: () => 'Hàng hoá',
      statusLabel: (status) => (status === 'active' ? 'Đang bán' : status),
      stockLabel: (stock) => (stock.tracked ? String(stock.onHand) : 'Còn hàng'),
    }
    expect(goodsCells(sized, context)).toEqual({
      name: 'Cà phê sữa',
      sku: 'CF-S, CF-L',
      barcode: '8930001',
      unit: 'Ly',
      cost_price: '12.000 ₫',
      price: '20.000 ₫ – 35.000 ₫',
      tax: 'VAT (8%)',
      status: 'Đang bán',
      stock: '0',
      product_type: 'Hàng hoá',
    })
  })

  it('writes CSV with a BOM, quoting and formula-safe cells', () => {
    expect(
      toCsv([
        ['Tên', 'Giá'],
        ['Bánh "mì", nóng', '=1+1'],
      ]),
    ).toBe('﻿Tên,Giá\r\n"Bánh ""mì"", nóng",\'=1+1\r\n')
  })
})

describe('generated SKU', () => {
  it('takes one above the highest generated code and ignores others', () => {
    expect(nextSku([])).toBe('SP000001')
    expect(nextSku(['SP000009', 'SP000123', 'SPX', 'HIEN-001', null])).toBe('SP000124')
    expect(nextSku(['SP999999'])).toBe('SP1000000')
  })
})

describe('image check', () => {
  it('accepts PNG and JPG up to 2 MB', () => {
    expect(imageProblem({ type: 'image/png', size: 2 * 1024 * 1024 })).toBeNull()
    expect(imageProblem({ type: 'image/webp', size: 10 })).toBe('type')
    expect(imageProblem({ type: 'image/jpeg', size: 2 * 1024 * 1024 + 1 })).toBe('size')
  })
})

describe('form schema', () => {
  const values = {
    ...emptyGoodsProduct(['branch_a', 'branch_b']),
    name: '  Trà đào ',
    price: '25.000',
    costPrice: '9000',
    prepMinutes: '5',
    openingStock: { branch_a: '12', branch_b: '' },
  }
  it('parses VND as typed at the counter and drops blank opening counts', () => {
    const parsed = goodsProductSchema('VND').parse(values)
    expect(parsed).toMatchObject({
      name: 'Trà đào',
      price: '25000',
      costPrice: '9000',
      prepMinutes: 5,
      openingStock: { branch_a: 12 },
    })
  })
  it('reports each bad field with its message key', () => {
    const result = goodsProductSchema('VND').safeParse({
      ...values,
      name: ' ',
      price: '25,5',
      sku: 'SP 1',
      prepMinutes: '700',
      openingStock: { branch_a: '-1' },
    })
    expect(result.success).toBe(false)
    const issues = result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])
    expect(issues).toEqual(
      expect.arrayContaining([
        ['name', 'goods.products.form.errors.name'],
        ['price', 'goods.products.form.errors.price'],
        ['sku', 'goods.products.form.errors.sku'],
        ['prepMinutes', 'goods.products.form.errors.prep'],
        ['openingStock.branch_a', 'goods.products.form.errors.stock'],
      ]),
    )
  })
  it('reads decimals for other currencies', () => {
    expect(goodsProductSchema('USD').parse({ ...values, price: '4.50' }).price).toBe('4.5')
  })
})

describe('payloads', () => {
  const parsed = goodsProductSchema('VND').parse({
    ...emptyGoodsProduct(['branch_a', 'branch_b']),
    name: 'Trà đào',
    sku: 'SP000007',
    barcode: '893123',
    price: '25000',
    costPrice: '9000',
    taxCategoryId: 'taxcat_vat',
    categoryIds: ['ctg_drinks'],
    prepMinutes: '5',
    openingStock: { branch_a: '12' },
  })

  it('creates an active product on the pos channel with opening stock per branch', () => {
    expect(
      productCreateBody(parsed, {
        currency: 'VND',
        channelId: 'ch_pos',
        productTypeId: 'pt_goods',
        stockLocations: { branch_a: 'sloc_a', branch_b: 'sloc_b' },
        imageSignedId: 'signed-1',
      }),
    ).toEqual({
      name: 'Trà đào',
      status: 'active',
      product_type_id: 'pt_goods',
      tax_category_id: 'taxcat_vat',
      category_ids: ['ctg_drinks'],
      metadata: { prep_minutes: 5 },
      prices: [{ currency: 'VND', amount: '25000' }],
      product_publications: [{ channel_id: 'ch_pos' }],
      media: [{ signed_id: 'signed-1' }],
      variants: [
        {
          sku: 'SP000007',
          barcode: '893123',
          cost_price: '9000',
          cost_currency: 'VND',
          track_inventory: true,
          stock_levels: [
            { stock_location_id: 'sloc_a', count_on_hand: 12 },
            { stock_location_id: 'sloc_b', count_on_hand: 0 },
          ],
        },
      ],
    })
  })

  it('writes no stock levels for an untracked item', () => {
    const body = productCreateBody(
      { ...parsed, trackInventory: false, costPrice: null },
      { currency: 'VND', channelId: 'ch_pos', productTypeId: 'pt_goods', stockLocations: {} },
    )
    expect(body.variants).toEqual([
      { sku: 'SP000007', barcode: '893123', cost_price: null, track_inventory: false },
    ])
  })

  it('edits without stock levels and keeps other metadata', () => {
    const body = productUpdateBody(
      { ...parsed, prepMinutes: null },
      { default_variant_id: 'variant_1', metadata: { erp: 'X1', prep_minutes: 3 }, variants: [] },
      { currency: 'VND', productTypeId: 'pt_service' },
    )
    expect(body.metadata).toEqual({ erp: 'X1' })
    expect(body.product_type_id).toBe('pt_service')
    expect(body.variants).toEqual([
      {
        id: 'variant_1',
        sku: 'SP000007',
        barcode: '893123',
        cost_price: '9000',
        cost_currency: 'VND',
        track_inventory: true,
      },
    ])
    expect(JSON.stringify(body)).not.toContain('stock_levels')
  })

  it('leaves per-variant prices and codes of a product with options alone', () => {
    const body = productUpdateBody(
      parsed,
      { ...sized, metadata: {} },
      {
        currency: 'VND',
        productTypeId: 'pt_goods',
      },
    )
    expect(body).not.toHaveProperty('prices')
    expect(body).not.toHaveProperty('variants')
  })

  it('round-trips a stored product into form values', () => {
    const values = formFromProduct(
      {
        ...product(),
        description: 'Ngon',
        metadata: { prep_minutes: 10 },
        categories: [{ id: 'ctg_drinks' }],
      },
      { kind: 'goods', unitCode: 'ly', branchIds: ['branch_a'] },
    )
    expect(values).toMatchObject({
      name: 'Cà phê sữa',
      sku: 'SP000001',
      barcode: '8930001',
      price: '25000',
      costPrice: '12000',
      prepMinutes: '10',
      unitCode: 'ly',
      categoryIds: ['ctg_drinks'],
      branchIds: ['branch_a'],
    })
  })
})

describe('branch changes', () => {
  it('adds and removes only the difference', () => {
    expect(branchChanges(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] })
    expect(branchChanges([], [])).toEqual({ add: [], remove: [] })
  })
})

describe('attributes in the form', () => {
  const base = { ...emptyGoodsProduct(['branch_a']), name: 'Áo thun', price: '' }
  const attributes = [
    { name: 'Màu sắc', values: ['Đỏ', 'Xanh'] },
    { name: 'Size', values: ['M'] },
  ]
  const rows = syncVariantRows(attributes, [], [], { price: '120.000', costPrice: '' })
  it('prices each kept variant instead of the product and drops left-out ones', () => {
    const parsed = goodsProductSchema('VND').parse({
      ...base,
      attributes,
      variants: rows.map((row, index) => (index === 1 ? { ...row, enabled: false } : row)),
    })
    expect(parsed.variants.map((row) => [row.values, row.price])).toEqual([[['Đỏ', 'M'], '120000']])
    const body = productCreateBody(parsed, {
      currency: 'VND',
      channelId: 'ch_pos',
      productTypeId: 'pt_goods',
      stockLocations: { branch_a: 'sloc_a' },
    })
    expect(body).not.toHaveProperty('prices')
    expect(body.variants).toHaveLength(1)
    expect(body.variants?.[0]).toMatchObject({ prices: [{ currency: 'VND', amount: '120000' }] })
  })
  it('reports attribute, row and duplicate SKU problems on their fields', () => {
    const result = goodsProductSchema('VND').safeParse({
      ...base,
      attributes: [{ name: ' ', values: [] }, ...attributes],
      variants: rows.map((row) => ({
        ...row,
        sku: 'SAME',
        price: row.key.includes('xanh') ? 'x' : row.price,
      })),
    })
    const issues = result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])
    expect(issues).toEqual(
      expect.arrayContaining([
        ['attributes.0.name', 'goods.products.form.errors.attributeName'],
        ['attributes.0.values', 'goods.products.form.errors.attributeValues'],
        ['variants.1.price', 'goods.products.form.errors.price'],
        ['variants.1.sku', 'goods.products.form.errors.skuDuplicate'],
      ]),
    )
    expect(issues).not.toContainEqual(['price', 'goods.products.form.errors.price'])
  })
  it('needs one variant kept', () => {
    const result = goodsProductSchema('VND').safeParse({
      ...base,
      attributes,
      variants: rows.map((row) => ({ ...row, enabled: false })),
    })
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('variants')
  })
})
