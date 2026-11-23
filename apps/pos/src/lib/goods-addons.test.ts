import { describe, expect, it } from 'vitest'
import {
  type AddonGroup,
  blankOption,
  defaultsFit,
  describeSelection,
  membershipWrites,
  moveRow,
  optionDrafts,
  optionProblem,
  optionRows,
  ruleForm,
  ruleLimits,
} from './goods-addons'

const t = (key: string, values?: Record<string, number>) =>
  values
    ? `${key}(${Object.entries(values)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')})`
    : key
const limits = (min_select: number, max_select: number, allow_quantity = false) => ({
  min_select,
  max_select,
  allow_quantity,
})

describe('describeSelection', () => {
  it('says whether the group is required and how many may be picked', () => {
    expect(describeSelection(limits(0, 1), t)).toBe(
      'goods.addons.rule.optional · goods.addons.rule.upTo(count=1)',
    )
    expect(describeSelection(limits(1, 1), t)).toBe(
      'goods.addons.rule.required · goods.addons.rule.exactly(count=1)',
    )
    expect(describeSelection(limits(1, 3), t)).toBe(
      'goods.addons.rule.required · goods.addons.rule.range(min=1,max=3)',
    )
    expect(describeSelection(limits(0, 4), t)).toBe(
      'goods.addons.rule.optional · goods.addons.rule.upTo(count=4)',
    )
  })

  it('mentions quantities only where more than one pick counts', () => {
    expect(describeSelection(limits(0, 5, true), t)).toBe(
      'goods.addons.rule.optional · goods.addons.rule.upTo(count=5) · goods.addons.rule.quantity',
    )
    expect(describeSelection(limits(0, 1, true), t)).not.toContain('quantity')
  })
})

describe('rule switches', () => {
  it('reads the switches from stored limits', () => {
    expect(ruleForm()).toEqual({
      required: false,
      multiple: false,
      allowQuantity: false,
      min: '1',
      max: '2',
    })
    expect(ruleForm(limits(2, 4, true))).toEqual({
      required: true,
      multiple: true,
      allowQuantity: true,
      min: '2',
      max: '4',
    })
    // A single-pick group cannot count quantities.
    expect(ruleForm(limits(0, 1, true)).allowQuantity).toBe(false)
  })

  it('maps the switches to min, max and quantities', () => {
    const base = ruleForm()
    expect(ruleLimits(base)).toEqual(limits(0, 1))
    expect(ruleLimits({ ...base, required: true })).toEqual(limits(1, 1))
    expect(ruleLimits({ ...base, multiple: true, max: '3' })).toEqual(limits(0, 3))
    expect(ruleLimits({ ...base, multiple: true, allowQuantity: true, max: '5' })).toEqual(
      limits(0, 5, true),
    )
    expect(ruleLimits({ ...base, required: true, multiple: true, min: '2', max: '3' })).toEqual(
      limits(2, 3),
    )
    // A single choice drops quantities even when the switch was on before.
    expect(ruleLimits({ ...base, allowQuantity: true })).toEqual(limits(0, 1))
  })

  it('refuses counts the server would refuse', () => {
    const multiple = { ...ruleForm(), multiple: true }
    expect(ruleLimits({ ...multiple, max: '1' })).toBeNull()
    expect(ruleLimits({ ...multiple, max: 'x' })).toBeNull()
    expect(ruleLimits({ ...multiple, max: '51' })).toBeNull()
    expect(ruleLimits({ ...multiple, required: true, min: '0', max: '3' })).toBeNull()
    expect(ruleLimits({ ...multiple, required: true, min: '4', max: '3' })).toBeNull()
  })
})

describe('options', () => {
  const group: AddonGroup = {
    id: 'g1',
    name: 'Topping',
    min_select: 0,
    max_select: 2,
    allow_quantity: false,
    required: false,
    position: 0,
    options: [
      {
        id: 'o1',
        name: 'Trân châu',
        price_delta: '5000.0',
        cost_price: '1500.5',
        variant_id: null,
        default_selected: true,
        position: 0,
        active: true,
      },
      {
        id: 'o2',
        name: 'Thạch',
        price_delta: '4000.0',
        variant_id: null,
        default_selected: false,
        position: 1,
        active: false,
      },
    ],
  }

  it('keeps a cost it never read and sends the rest in the order shown', () => {
    const drafts = optionDrafts(group)
    expect(drafts.map((row) => [row.price, row.cost, row.costKnown, row.inStock])).toEqual([
      ['5000', '1500.5', true, true],
      ['4000', '', false, false],
    ])
    const moved = moveRow([...drafts, { ...blankOption('n1'), name: ' Kem ', cost: '' }], 2, 0)
    expect(moved && optionRows(moved)).toEqual([
      {
        name: 'Kem',
        price_delta: '0',
        cost_price: null,
        active: true,
        default_selected: false,
        position: 0,
      },
      {
        id: 'o1',
        name: 'Trân châu',
        price_delta: '5000',
        cost_price: '1500.5',
        active: true,
        default_selected: true,
        position: 1,
      },
      {
        id: 'o2',
        name: 'Thạch',
        price_delta: '4000',
        active: false,
        default_selected: false,
        position: 2,
      },
    ])
  })

  it('checks names, prices, costs and default picks', () => {
    expect(optionProblem({ ...blankOption('a'), name: ' ' })).toBe('name')
    expect(optionProblem({ ...blankOption('a'), name: 'A', price: '-1' })).toBe('price')
    expect(optionProblem({ ...blankOption('a'), name: 'A', cost: '1,5' })).toBe('cost')
    expect(optionProblem({ ...blankOption('a'), name: 'A', cost: '1.5' })).toBeNull()
    const two = [
      { ...blankOption('a'), defaultSelected: true },
      { ...blankOption('b'), defaultSelected: true },
    ]
    expect(defaultsFit(two, limits(0, 1))).toBe(false)
    expect(defaultsFit(two, limits(0, 2))).toBe(true)
    expect(defaultsFit([two[0], { ...two[1], inStock: false }], limits(0, 1))).toBe(true)
  })

  it('moves nothing out of range', () => {
    expect(moveRow([1, 2], 0, 0)).toBeNull()
    expect(moveRow([1, 2], 0, 2)).toBeNull()
    expect(moveRow([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
  })
})

describe('membershipWrites', () => {
  const items = [
    { product_id: 'p1', name: 'Trà', kind: 'single', modifier_group_ids: ['g0', 'g1'] },
    { product_id: 'p2', name: 'Cà phê', kind: 'single', modifier_group_ids: ['g0'] },
    { product_id: 'p3', name: 'Combo', kind: 'combo', modifier_group_ids: [] },
    { product_id: 'p4', name: 'Bánh', kind: 'single', modifier_group_ids: [] },
  ]

  it('adds and removes the group by product, keeping the other groups in order', () => {
    expect(membershipWrites(items, 'g1', new Set(['p2', 'p3']))).toEqual([
      { product_id: 'p1', modifier_group_ids: ['g0'] },
      { product_id: 'p2', modifier_group_ids: ['g0', 'g1'] },
    ])
    expect(membershipWrites(items, 'g1', new Set(['p1']))).toEqual([])
  })
})
