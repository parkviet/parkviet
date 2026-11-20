import { describe, expect, it } from 'vitest'
import {
  comboQuantityValid,
  copiedOperations,
  DEFAULT_OPERATIONS,
  operationsForm,
  operationsOf,
  operationsProblems,
  operationWrites,
  type ProductPosConfig,
  parseOperations,
  sameOperations,
  withComboRow,
} from './product-operations'

const config = (overrides: Partial<ProductPosConfig> = {}): ProductPosConfig => ({
  product_id: 'prod_tea',
  name: 'Trà sữa',
  product_kind: 'prepared',
  kind: 'single',
  kitchen_category: null,
  cup_label: false,
  show_components_on_kds: true,
  qr_orderable: true,
  drink_credit: null,
  drink_credit_categories: [],
  tax_category_id: null,
  modifier_group_ids: [],
  components: [],
  ...overrides,
})

describe('operating settings in the form', () => {
  it('reads stored settings as typed and back, keeping amounts whole', () => {
    const stored = operationsOf(
      config({
        kitchen_category: 'do_uong',
        cup_label: true,
        drink_credit: '100000.0',
        drink_credit_categories: ['do_uong', 'bia'],
      }),
    )
    const form = operationsForm(stored)
    expect(form).toEqual({
      kitchenCategory: 'do_uong',
      cupLabel: true,
      showComponentsOnKds: true,
      qrOrderable: true,
      drinkCredit: '100000',
      drinkCreditCategories: 'do_uong, bia',
    })
    expect(sameOperations(parseOperations(form), stored)).toBe(true)
  })

  it('reads a product without settings as the server defaults', () => {
    expect(operationsOf(null)).toEqual(DEFAULT_OPERATIONS)
  })

  it('names the fields the server would refuse', () => {
    const form = operationsForm(DEFAULT_OPERATIONS)
    expect(operationsProblems(form)).toEqual([])
    expect(
      operationsProblems({
        ...form,
        kitchenCategory: 'Bếp',
        drinkCredit: '12.5',
        drinkCreditCategories: 'do_uong,,a',
      }),
    ).toEqual(['kitchenCategory', 'drinkCredit', 'drinkCreditCategories'])
  })

  it('trims, empties to null and drops repeated credit categories', () => {
    expect(
      parseOperations({
        ...operationsForm(DEFAULT_OPERATIONS),
        kitchenCategory: '  ',
        drinkCredit: ' 50000 ',
        drinkCreditCategories: 'do_uong, do_uong ,bia',
      }),
    ).toMatchObject({
      kitchen_category: null,
      drink_credit: '50000',
      drink_credit_categories: ['do_uong', 'bia'],
    })
  })
})

describe('combo rows', () => {
  it('accepts whole quantities from 1 to 100 and adds a variant once', () => {
    expect(['1', '100', ' 7 '].map(comboQuantityValid)).toEqual([true, true, true])
    expect(['0', '101', '1.5', ''].map(comboQuantityValid)).toEqual([false, false, false, false])
    const rows = withComboRow([], { variantId: 'v_tea', name: 'Trà' })
    expect(rows).toEqual([{ variantId: 'v_tea', name: 'Trà', quantity: '1' }])
    expect(withComboRow(rows, { variantId: 'v_tea', name: 'Trà' })).toEqual(rows)
  })
})

describe('operationWrites', () => {
  const next = {
    operations: operationsOf(null),
    comboComponents: [],
    modifierGroupIds: [],
  }

  it('writes nothing for a new product left at the defaults', () => {
    expect(operationWrites('prod_tea', null, next)).toEqual([])
  })

  it('writes only what changed, comparing amounts by value', () => {
    const current = config({ drink_credit: '100000.0', modifier_group_ids: ['g1'] })
    expect(
      operationWrites('prod_tea', current, {
        ...next,
        operations: { ...operationsOf(current), drink_credit: '100000' },
        modifierGroupIds: ['g1', 'g2'],
      }),
    ).toEqual([
      {
        step: 'addons',
        path: '/pos/products/prod_tea/modifier_groups',
        body: { modifier_group_ids: ['g1', 'g2'] },
      },
    ])
  })

  it('clears the groups before making a combo, and the combo before adding groups', () => {
    const single = config({ modifier_group_ids: ['g1'] })
    expect(
      operationWrites('prod_tea', single, {
        ...next,
        comboComponents: [{ variant_id: 'v_cake', quantity: 1 }],
        modifierGroupIds: ['g1'],
      }).map((write) => write.step),
    ).toEqual(['addons', 'combo'])
    const combo = config({
      kind: 'combo',
      components: [{ id: 'c1', variant_id: 'v_cake', name: 'Bánh', quantity: 1 }],
    })
    expect(operationWrites('prod_tea', combo, { ...next, modifierGroupIds: ['g1'] })).toEqual([
      { step: 'combo', path: '/pos/products/prod_tea/combo', body: { components: [] } },
      {
        step: 'addons',
        path: '/pos/products/prod_tea/modifier_groups',
        body: { modifier_group_ids: ['g1'] },
      },
    ])
  })
})

describe('copiedOperations', () => {
  it('takes the kitchen settings, add-on groups and combo contents of the source', () => {
    const copied = copiedOperations(
      config({
        kitchen_category: 'bar',
        qr_orderable: false,
        modifier_group_ids: ['g1'],
        components: [{ id: 'c1', variant_id: 'v_cake', name: 'Bánh', quantity: 2 }],
      }),
    )
    expect(copied).toEqual({
      operations: expect.objectContaining({ kitchenCategory: 'bar', qrOrderable: false }),
      modifierGroupIds: ['g1'],
      comboComponents: [{ variantId: 'v_cake', name: 'Bánh', quantity: '2' }],
    })
  })
})
