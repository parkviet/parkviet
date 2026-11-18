import { describe, expect, it } from 'vitest'
import {
  canPause,
  formulaPrice,
  listChannels,
  listCode,
  newPriceListValues,
  nextListCode,
  type PriceListFormValues,
  priceListPayload,
  priceListState,
  priceListValues,
  pricingMethodOf,
  type ScreenList,
  stateCounts,
  validatePriceList,
  zonedDay,
  zonedInstant,
} from './goods-price-list-form'

const NOW = new Date('2026-11-18T05:00:00Z')
const list = (patch: Partial<ScreenList> = {}): ScreenList => ({
  id: 'pl_1',
  name: 'Giá sỉ',
  description: 'BG000001',
  status: 'active',
  starts_at: null,
  ends_at: null,
  price_rules: [],
  ...patch,
})
const ZONE = 'Asia/Ho_Chi_Minh'

describe('priceListState', () => {
  it('reads active, pending, paused and expired from status and dates', () => {
    expect(priceListState(list(), NOW)).toBe('active')
    expect(priceListState(list({ starts_at: '2026-11-17T17:00:00Z' }), NOW)).toBe('active')
    expect(
      priceListState(list({ status: 'scheduled', starts_at: '2026-11-20T00:00:00Z' }), NOW),
    ).toBe('pending')
    expect(priceListState(list({ status: 'draft' }), NOW)).toBe('pending')
    expect(priceListState(list({ status: 'inactive' }), NOW)).toBe('paused')
    expect(priceListState(list({ status: 'inactive', ends_at: '2026-11-01T00:00:00Z' }), NOW)).toBe(
      'expired',
    )
    expect(priceListState(list({ ends_at: '2026-11-18T04:59:59Z' }), NOW)).toBe('expired')
  })

  it('counts every tab', () => {
    const counts = stateCounts(
      [list(), list({ status: 'inactive' }), list({ status: 'draft' }), list()],
      NOW,
    )
    expect(counts).toEqual({ all: 4, active: 2, pending: 1, paused: 1, expired: 0 })
  })

  it('pauses only lists that are on', () => {
    expect(canPause(list({ status: 'scheduled' }))).toBe(true)
    expect(canPause(list({ status: 'inactive' }))).toBe(false)
    expect(canPause(list({ status: 'draft' }))).toBe(false)
  })
})

describe('rules and codes', () => {
  const rules = [
    {
      id: 'r1',
      type: 'channel_rule',
      preferences: { channel_ids: ['ch_pos'] },
      channels: [{ id: 'ch_pos', name: 'POS' }],
    },
    { id: 'r2', type: 'volume_rule', preferences: { min_quantity: 10, max_quantity: null } },
    { id: 'r3', type: 'market_rule', preferences: { market_ids: ['mkt_1'] } },
  ]

  it('reads the method and the channels', () => {
    expect(pricingMethodOf(list({ price_rules: rules }))).toBe('volume')
    expect(pricingMethodOf(list())).toBe('fixed')
    expect(listChannels(list({ price_rules: rules }))).toEqual([{ id: 'ch_pos', name: 'POS' }])
    expect(listChannels(list())).toEqual([])
  })

  it('takes a code-like description as the code and generates the next one', () => {
    expect(listCode(list({ description: ' BG000007 ' }))).toBe('BG000007')
    expect(listCode(list({ description: 'Prices for the summer sale' }))).toBe('')
    expect(nextListCode([list({ description: 'BG000009' }), list({ description: 'X1' })])).toBe(
      'BG000010',
    )
    expect(nextListCode([])).toBe('BG000001')
  })

  it('keeps rules it does not manage and the ids of those it does', () => {
    const existing = list({ price_rules: rules })
    const values: PriceListFormValues = {
      ...priceListValues(existing, { timeZone: ZONE, groupIds: null }),
      minQuantity: '12',
      maxQuantity: '99',
    }
    const payload = priceListPayload(values, { timeZone: ZONE, existing, fallbackCode: 'BG000002' })
    expect(payload.rules).toEqual([
      { id: 'r3', type: 'market_rule', preferences: { market_ids: ['mkt_1'] } },
      { id: 'r1', type: 'channel_rule', preferences: { channel_ids: ['ch_pos'] } },
      { id: 'r2', type: 'volume_rule', preferences: { min_quantity: 12, max_quantity: 99 } },
    ])
    const fixed = priceListPayload(
      { ...values, method: 'fixed', channelIds: [] },
      { timeZone: ZONE, existing, fallbackCode: 'BG000002' },
    )
    expect(fixed.rules.map((item) => item.type)).toEqual(['market_rule'])
  })

  it('gives a customer-group list no channel rule and fills a blank code', () => {
    const values = {
      ...newPriceListValues({ code: '', today: '2026-11-18', posChannelId: 'ch_pos' }),
      name: ' Khách sỉ ',
      audience: 'groups' as const,
      groupIds: ['cg_1'],
    }
    const payload = priceListPayload(values, { timeZone: ZONE, fallbackCode: 'BG000003' })
    expect(payload).toMatchObject({
      name: 'Khách sỉ',
      description: 'BG000003',
      starts_at: '2026-11-17T17:00:00.000Z',
      ends_at: null,
      rules: [],
    })
  })
})

describe('dates in the store time zone', () => {
  it('maps days to the start and end instants and back', () => {
    expect(zonedInstant('2026-11-18', 'start', ZONE)).toBe('2026-11-17T17:00:00.000Z')
    expect(zonedInstant('2026-11-30', 'end', ZONE)).toBe('2026-11-30T16:59:59.000Z')
    expect(zonedInstant('18/11/2026', 'start', ZONE)).toBeNull()
    expect(zonedDay('2026-11-17T17:00:00.000Z', ZONE)).toBe('2026-11-18')
    expect(zonedDay('2026-11-17T16:59:59.000Z', ZONE)).toBe('2026-11-17')
  })
})

describe('formulaPrice', () => {
  it('raises or lowers the selling price by a percentage or an amount', () => {
    const f = (direction: 'increase' | 'decrease', kind: 'percent' | 'amount', value: string) => ({
      direction,
      kind,
      value,
    })
    expect(formulaPrice('38000', f('decrease', 'percent', '10'), 'VND')).toBe('34200')
    expect(formulaPrice('33333', f('decrease', 'percent', '15'), 'VND')).toBe('28333')
    expect(formulaPrice('38000', f('increase', 'amount', '2000'), 'VND')).toBe('40000')
    expect(formulaPrice('19.99', f('increase', 'percent', '5'), 'USD')).toBe('20.99')
    expect(formulaPrice('1000', f('decrease', 'amount', '2000'), 'VND')).toBeNull()
    expect(formulaPrice('1000', f('decrease', 'percent', '100'), 'VND')).toBeNull()
    expect(formulaPrice(null, f('decrease', 'percent', '10'), 'VND')).toBeNull()
    expect(formulaPrice('1000', f('decrease', 'percent', 'abc'), 'VND')).toBeNull()
  })
})

describe('validatePriceList', () => {
  const base = {
    ...newPriceListValues({ code: '', today: '2026-11-18', posChannelId: null }),
    name: 'Giá sỉ',
  }
  it('accepts a minimal list and reports each problem', () => {
    expect(validatePriceList(base)).toEqual({})
    expect(
      validatePriceList({
        ...base,
        code: 'BG 1',
        name: ' ',
        noEnd: false,
        endsOn: '2026-11-01',
        audience: 'groups',
        method: 'volume',
        minQuantity: '0',
      }),
    ).toEqual({
      code: 'code',
      name: 'name',
      endsOn: 'endBeforeStart',
      groupIds: 'groups',
      minQuantity: 'quantity',
    })
    expect(validatePriceList({ ...base, noEnd: false, endsOn: '' })).toEqual({
      endsOn: 'endRequired',
    })
    expect(
      validatePriceList({ ...base, method: 'volume', minQuantity: '10', maxQuantity: '5' }),
    ).toEqual({ maxQuantity: 'maxBelowMin' })
    expect(
      validatePriceList({
        ...base,
        method: 'formula',
        formula: { direction: 'decrease', kind: 'percent', value: '120' },
      }),
    ).toEqual({ formula: 'formula' })
  })
})
