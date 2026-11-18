import { describe, expect, it } from 'vitest'
import {
  attributesFromVariants,
  combinations,
  comboKey,
  createdVariants,
  type OptionNames,
  optionSlug,
  type ParsedVariantRow,
  planOptionTypes,
  productUpdateVariants,
  syncVariantRows,
  variantChanges,
} from './goods-variants'

const attributes = [
  { name: 'Màu sắc', values: ['Đỏ', 'Xanh'] },
  { name: 'Size', values: ['M', 'L'] },
]
const value = (typeId: string, typeLabel: string, id: string, label: string, position = 1) => ({
  id,
  option_type_id: typeId,
  option_type_label: typeLabel,
  name: optionSlug(label),
  label,
  position,
})
const parsedRow = (values: string[], extra: Partial<ParsedVariantRow> = {}): ParsedVariantRow => ({
  key: comboKey(values),
  values,
  variantId: null,
  sku: `SKU-${values.join('-')}`,
  barcode: '',
  price: '30000',
  costPrice: null,
  openingStock: {},
  ...extra,
})
const names: OptionNames = [
  {
    type: 'mau-sac',
    values: new Map([
      ['đỏ', 'do'],
      ['xanh', 'xanh'],
    ]),
  },
  {
    type: 'size',
    values: new Map([
      ['m', 'm'],
      ['l', 'l'],
    ]),
  },
]
const context = {
  currency: 'VND',
  trackInventory: true,
  stockLocations: { branch_a: 'sloc_a', branch_b: 'sloc_b' },
  branchIds: ['branch_a'],
  names,
}

describe('optionSlug', () => {
  it('drops marks and keeps an ASCII name', () => {
    expect(optionSlug('Màu sắc')).toBe('mau-sac')
    expect(optionSlug('Đỏ đậm')).toBe('do-dam')
    expect(optionSlug(' 500 ml ')).toBe('500-ml')
    expect(optionSlug('++')).toBe('')
  })
})

describe('combinations and the matrix', () => {
  it('makes one combination per value of each attribute, in order', () => {
    expect(combinations(attributes)).toEqual([
      ['Đỏ', 'M'],
      ['Đỏ', 'L'],
      ['Xanh', 'M'],
      ['Xanh', 'L'],
    ])
    expect(combinations([])).toEqual([])
    expect(combinations([{ name: 'Size', values: [] }])).toEqual([])
  })

  it('keeps typed rows, prefills new ones and brings a stored variant back', () => {
    const first = syncVariantRows([attributes[0]], [], [], { price: '25000', costPrice: '9000' })
    expect(first.map((row) => [row.values, row.price, row.costPrice, row.enabled])).toEqual([
      [['Đỏ'], '25000', '9000', true],
      [['Xanh'], '25000', '9000', true],
    ])
    const typed = first.map((row, index) => ({ ...row, sku: `S${index}` }))
    const stored = { ...typed[1], variantId: 'variant_xanh' }
    // Removing Xanh and adding it back edits the stored variant again.
    const without = syncVariantRows([{ ...attributes[0], values: ['Đỏ'] }], typed, [stored], {
      price: '',
      costPrice: '',
    })
    expect(without.map((row) => row.sku)).toEqual(['S0'])
    const back = syncVariantRows(
      [{ ...attributes[0], values: ['Đỏ', 'xanh'] }],
      without,
      [stored],
      {
        price: '',
        costPrice: '',
      },
    )
    expect(back[1]).toMatchObject({ variantId: 'variant_xanh', sku: 'S1', values: ['xanh'] })
  })
})

describe('attributesFromVariants', () => {
  it('reads the attributes back and leaves combinations the product never had out', () => {
    const {
      attributes: read,
      rows,
      derivable,
    } = attributesFromVariants([
      {
        id: 'v1',
        sku: 'A',
        barcode: null,
        cost_price: '9000',
        price: { amount: '30000' },
        option_values: [
          value('ot_color', 'Màu sắc', 'ov_red', 'Đỏ'),
          value('ot_size', 'Size', 'ov_m', 'M'),
        ],
      },
      {
        id: 'v2',
        sku: 'B',
        barcode: '893',
        cost_price: null,
        price: { amount: '35000' },
        option_values: [
          value('ot_size', 'Size', 'ov_l', 'L', 2),
          value('ot_color', 'Màu sắc', 'ov_red', 'Đỏ'),
        ],
      },
      {
        id: 'v3',
        sku: 'C',
        barcode: null,
        cost_price: null,
        price: { amount: '30000' },
        option_values: [
          value('ot_color', 'Màu sắc', 'ov_blue', 'Xanh', 2),
          value('ot_size', 'Size', 'ov_m', 'M'),
        ],
      },
    ])
    expect(derivable).toBe(true)
    expect(read).toEqual(attributes)
    expect(
      rows.map((row) => [row.values.join('/'), row.variantId, row.enabled, row.price]),
    ).toEqual([
      ['Đỏ/M', 'v1', true, '30000'],
      ['Đỏ/L', 'v2', true, '35000'],
      ['Xanh/M', 'v3', true, '30000'],
      ['Xanh/L', null, false, ''],
    ])
  })

  it('refuses variants that do not name every attribute', () => {
    expect(
      attributesFromVariants([
        { id: 'v1', sku: null, barcode: null, cost_price: null, options_text: 'Size: S' },
      ]).derivable,
    ).toBe(false)
  })
})

describe('planOptionTypes', () => {
  it('creates a missing type and extends a stored one, keeping its values', () => {
    const plan = planOptionTypes(attributes, [
      {
        id: 'ot_size',
        name: 'size',
        label: 'SIZE',
        option_values: [{ id: 'ov_m', name: 'm', label: 'M', position: 1 }],
      },
    ])
    expect(plan.writes).toEqual([
      {
        kind: 'create',
        params: {
          name: 'mau-sac',
          label: 'Màu sắc',
          option_values: [
            { name: 'do', label: 'Đỏ', position: 1 },
            { name: 'xanh', label: 'Xanh', position: 2 },
          ],
        },
      },
      {
        kind: 'update',
        id: 'ot_size',
        params: {
          option_values: [
            { id: 'ov_m', name: 'm', label: 'M', position: 1 },
            { name: 'l', label: 'L', position: 2 },
          ],
        },
      },
    ])
    expect(plan.names[1].type).toBe('size')
    expect(plan.names[0].values.get('đỏ')).toBe('do')
  })

  it('writes nothing when every value is already stored', () => {
    const plan = planOptionTypes(
      [{ name: 'size', values: ['m'] }],
      [
        {
          id: 'ot_size',
          name: 'size',
          label: 'Size',
          option_values: [{ id: 'ov_m', name: 'm', label: 'M', position: 1 }],
        },
      ],
    )
    expect(plan.writes).toEqual([])
    expect(plan.names[0].values.get('m')).toBe('m')
  })

  it('gives two labels with the same slug different names', () => {
    const plan = planOptionTypes([{ name: 'Vị', values: ['Đá', 'Da'] }], [])
    expect(plan.writes[0]).toMatchObject({
      params: { option_values: [{ name: 'da' }, { name: 'da-2' }] },
    })
  })
})

describe('variant payloads', () => {
  it('creates each combination with its options, price and opening stock', () => {
    expect(
      createdVariants([parsedRow(['Đỏ', 'M'], { openingStock: { branch_a: 4 } })], context),
    ).toEqual([
      {
        options: [
          { name: 'mau-sac', value: 'do' },
          { name: 'size', value: 'm' },
        ],
        sku: 'SKU-Đỏ-M',
        barcode: '',
        cost_price: null,
        track_inventory: true,
        prices: [{ currency: 'VND', amount: '30000' }],
        stock_levels: [{ stock_location_id: 'sloc_a', count_on_hand: 4 }],
      },
    ])
  })

  it('turns a simple product into its first combination and creates the rest', () => {
    const changes = variantChanges(
      [parsedRow(['Đỏ', 'M'], { costPrice: '9000' }), parsedRow(['Đỏ', 'L'])],
      { default_variant_id: 'variant_main', variants: [{ id: 'variant_main', options_text: '' }] },
      context,
    )
    expect(changes.updates).toEqual([
      {
        id: 'variant_main',
        options: [
          { name: 'mau-sac', value: 'do' },
          { name: 'size', value: 'm' },
        ],
        sku: 'SKU-Đỏ-M',
        barcode: '',
        cost_price: '9000',
        cost_currency: 'VND',
        track_inventory: true,
        prices: [{ currency: 'VND', amount: '30000' }],
      },
    ])
    expect(changes.creates.map((item) => item.label)).toEqual(['Đỏ / L'])
    expect(changes.creates[0].params.stock_levels).toEqual([
      { stock_location_id: 'sloc_a', count_on_hand: 0 },
    ])
    expect(changes.deletes).toEqual([])
  })

  it('updates kept variants, creates new combinations and deletes the rest', () => {
    const changes = variantChanges(
      [parsedRow(['Đỏ', 'M'], { variantId: 'v1' }), parsedRow(['Xanh', 'M'])],
      {
        default_variant_id: 'v1',
        variants: [
          { id: 'v1', options_text: 'Màu sắc: Đỏ, Size: M' },
          { id: 'v2', options_text: 'Màu sắc: Đỏ, Size: L' },
        ],
      },
      { ...context, trackInventory: false },
    )
    expect(changes.updates).toEqual([expect.objectContaining({ id: 'v1', track_inventory: false })])
    expect(changes.updates[0]).not.toHaveProperty('options')
    expect(changes.creates[0].params).not.toHaveProperty('stock_levels')
    expect(changes.deletes).toEqual([{ id: 'v2', label: 'Màu sắc: Đỏ, Size: L' }])
  })
})

describe('productUpdateVariants', () => {
  it('keeps the variants to delete in the update so their removal is its own step', () => {
    expect(
      productUpdateVariants({
        updates: [{ id: 'v_m', sku: 'A-M' }],
        creates: [],
        deletes: [{ id: 'v_s', label: 'Size: S' }],
      }),
    ).toEqual([{ id: 'v_m', sku: 'A-M' }, { id: 'v_s' }])
  })

  it('sends nothing when no stored variant is kept', () => {
    expect(
      productUpdateVariants({ updates: [], creates: [], deletes: [{ id: 'v_s', label: 'S' }] }),
    ).toEqual([])
  })
})
