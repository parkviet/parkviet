import { describe, expect, it } from 'vitest'
import {
  normalizeTaxRegimeState,
  type TaxOption,
  type TaxRegimeState,
} from '../hooks/use-tax-regime'
import {
  formatDay,
  optionGroups,
  percentOf,
  regimeBody,
  regimeChange,
  regimeValues,
  sameValues,
  thresholdFill,
  validateTaxRegime,
  withMethod,
  withRevenueGroup,
} from './tax-regime'

const direct = (option: string, industry: string, name: string, exempt = false): TaxOption => ({
  tax_category_id: null,
  option,
  method: 'direct',
  label: exempt ? 'GTGT không chịu thuế – TNCN 1,5%' : 'GTGT 3% – TNCN 1,5%',
  industry,
  industry_name: name,
  vat_rate: exempt ? null : '0.03',
  pit_rate: '0.015',
  vat_exempt: exempt,
})
const deduction = (option: string, label: string): TaxOption => ({
  tax_category_id: null,
  option,
  method: 'deduction',
  label,
  industry: null,
  industry_name: null,
  vat_rate: '0.1',
  pit_rate: null,
  vat_exempt: false,
})

function state(over: Record<string, unknown> = {}): TaxRegimeState {
  return normalizeTaxRegimeState({
    regime: {
      id: 'postaxregime_1',
      enabled: true,
      method: 'deduction',
      revenue_group: 'group_3',
      pit_method: 'income',
      pit_income_rate: '0.17',
      prices_include_tax: true,
      apply_reduction: false,
      threshold_warning: true,
      default_item: { tax_category_id: 'tc_1', option: 'deduction.vat_10' },
      default_service_fee: { tax_category_id: 'tc_1', option: 'deduction.vat_10' },
      default_shipping: { tax_category_id: 'tc_2', option: 'deduction.vat_8' },
      changed_by_name: 'Admin',
      created_at: '2026-11-18T03:00:00Z',
    },
    available_options: {
      direct: [
        direct('direct.production_transport_food', 'production_transport_food', 'Dịch vụ ăn uống'),
        direct(
          'direct.production_transport_food_vat_exempt',
          'production_transport_food',
          'Dịch vụ ăn uống',
          true,
        ),
        direct('direct.goods', 'goods', 'Hàng hoá'),
      ],
      deduction: [
        deduction('deduction.vat_8', 'GTGT 8%'),
        deduction('deduction.vat_10', 'GTGT 10%'),
      ],
    },
    suggested_defaults: {
      direct: {
        item: 'direct.production_transport_food',
        service_fee: 'direct.production_transport_food',
        shipping: 'direct.production_transport_food',
      },
      deduction: {
        item: 'deduction.vat_8',
        service_fee: 'deduction.vat_8',
        shipping: 'deduction.vat_8',
      },
    },
    revenue_groups: [
      {
        code: 'group_1',
        name: 'G1',
        methods: ['direct'],
        pit_methods: ['revenue'],
        pit_income_rate: null,
      },
      {
        code: 'group_2',
        name: 'G2',
        methods: ['direct'],
        pit_methods: ['revenue', 'income'],
        pit_income_rate: '0.15',
      },
      {
        code: 'group_3',
        name: 'G3',
        methods: ['direct', 'deduction'],
        pit_methods: ['income'],
        pit_income_rate: '0.17',
      },
      {
        code: 'group_4',
        name: 'G4',
        methods: ['deduction', 'direct'],
        pit_methods: ['income'],
        pit_income_rate: '0.2',
      },
    ],
    product_count: 12,
    open_orders: 2,
    revenue_year: { year: 2026, revenue: '500000000', threshold: '1000000000', ratio: '0.5' },
    readiness: { filled: 8, total: 9, missing: ['signer_name'] },
    history: [],
    ...over,
  })
}

describe('tax regime state', () => {
  it('reads the defaults off the regime and drops rows the contract does not allow', () => {
    const read = state()
    expect(read.regime).toMatchObject({
      method: 'deduction',
      item_option: 'deduction.vat_10',
      shipping_option: 'deduction.vat_8',
    })
    const bad = normalizeTaxRegimeState({
      regime: { id: 'x', method: 'barter', revenue_group: 'group_1' },
    })
    expect(bad.regime).toBeNull()
    expect(bad.available_options.direct).toEqual([])
  })

  it('offers a store without a regime deduction with the suggested options', () => {
    const fresh = state({ regime: null })
    expect(regimeValues(fresh)).toMatchObject({
      enabled: true,
      method: 'deduction',
      revenue_group: 'group_3',
      pit_method: 'income',
      prices_include_tax: true,
      item_option: 'deduction.vat_8',
    })
    expect(regimeChange(regimeValues(fresh), fresh).unsaved).toBe(true)
  })
})

describe('draft changes', () => {
  it('starts a new method from the suggested options and restores the saved ones on return', () => {
    const current = state()
    const values = regimeValues(current)
    const toDirect = withMethod(values, 'direct', current)
    expect(toDirect).toMatchObject({
      method: 'direct',
      item_option: 'direct.production_transport_food',
      shipping_option: 'direct.production_transport_food',
    })
    expect(withMethod(toDirect, 'deduction', current)).toEqual(values)
  })

  it('moves to the first method and income method a group allows', () => {
    const current = state()
    const values = regimeValues(current)
    const group1 = withRevenueGroup(values, 'group_1', current)
    expect(group1).toMatchObject({
      revenue_group: 'group_1',
      method: 'direct',
      pit_method: 'revenue',
    })
    const group2 = withRevenueGroup(group1, 'group_2', current)
    expect(group2.pit_method).toBe('revenue')
    expect(
      withRevenueGroup({ ...group2, pit_method: 'income' }, 'group_2', current).pit_method,
    ).toBe('income')
    expect(withRevenueGroup(group2, 'group_4', current)).toMatchObject({
      method: 'direct',
      pit_method: 'income',
    })
  })

  it('tells a method switch from a default change, and notes prices turning exclusive', () => {
    const current = state()
    const values = regimeValues(current)
    expect(regimeChange(values, current)).toEqual({
      unsaved: false,
      methodChanged: false,
      defaultsChanged: false,
      pricesBecomeExclusive: false,
    })
    expect(
      regimeChange({ ...values, item_option: 'deduction.vat_8' }, current).defaultsChanged,
    ).toBe(true)
    expect(
      regimeChange({ ...values, prices_include_tax: false }, current).pricesBecomeExclusive,
    ).toBe(true)
    const switched = regimeChange(withMethod(values, 'direct', current), current)
    expect(switched.methodChanged).toBe(true)
    expect(switched.defaultsChanged).toBe(false)
    expect(sameValues(values, { ...values })).toBe(true)
    expect(sameValues(values, { ...values, enabled: false })).toBe(false)
  })

  it('sends every field of the draft', () => {
    const values = regimeValues(state())
    expect(regimeBody(values)).toEqual(values)
  })
})

describe('validateTaxRegime', () => {
  it('accepts the saved regime', () => {
    const current = state()
    expect(validateTaxRegime(regimeValues(current), current)).toEqual({})
  })

  it('names the field a combination breaks', () => {
    const current = state()
    const values = regimeValues(current)
    expect(validateTaxRegime({ ...values, revenue_group: 'group_1' }, current)).toMatchObject({
      method: 'taxRegime.errorMethod',
      pit_method: 'taxRegime.errorPit',
    })
    expect(validateTaxRegime({ ...values, item_option: 'direct.goods' }, current)).toEqual({
      item_option: 'taxRegime.errorOption',
    })
    expect(validateTaxRegime({ ...values, shipping_option: '' }, current).shipping_option).toBe(
      'taxRegime.errorOption',
    )
  })
})

describe('display helpers', () => {
  it('groups options by industry with both variants together', () => {
    const groups = optionGroups(state().available_options.direct)
    expect(groups.map((group) => [group.name, group.options.length])).toEqual([
      ['Dịch vụ ăn uống', 2],
      ['Hàng hoá', 1],
    ])
    expect(optionGroups(state().available_options.deduction)).toHaveLength(2)
  })

  it('formats percentages, days and the threshold bar', () => {
    expect(percentOf('0.015')).toBe('1.5')
    expect(percentOf('0.17')).toBe('17')
    expect(percentOf(null)).toBe('')
    expect(formatDay('2026-07-15')).toBe('15/07/2026')
    expect(formatDay(null)).toBe('—')
    expect(thresholdFill('0.5')).toBe(0.5)
    expect(thresholdFill('1.4')).toBe(1)
    expect(thresholdFill('nope')).toBe(0)
  })
})
