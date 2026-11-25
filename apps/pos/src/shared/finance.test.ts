import { describe, expect, it } from 'vitest'
import {
  buildCsv,
  datePresetRange,
  matchesReminderFilter,
  sortDebtors,
  vndToWords,
} from './finance'
import type { PosReceivableAccount } from './types/pos-context'

const makeAccount = (overrides: Partial<PosReceivableAccount> = {}): PosReceivableAccount => ({
  credit_account_id: 'ca_1',
  currency: 'VND',
  customer: { id: 'cus_1', name: 'Chị Hoa', phone: '0901234567' },
  orders: 1,
  credit_limit: '5000000',
  account_status: 'active',
  balance: '500000',
  overdue: '200000',
  current: '300000',
  days_1_30: '200000',
  days_31_60: '0',
  days_61_90: '0',
  days_over_90: '0',
  days_overdue: 5,
  last_reminded_at: null,
  promised_pay_on: null,
  ...overrides,
})

describe('vndToWords', () => {
  it('converts VND numbers to Vietnamese text', () => {
    expect(vndToWords(0)).toBe('Không đồng')
    expect(vndToWords(8000)).toBe('Tám nghìn đồng')
    expect(vndToWords(125000)).toBe('Một trăm hai mươi lăm nghìn đồng')
    expect(vndToWords(1005000)).toBe('Một triệu không trăm lẻ năm nghìn đồng')
  })
})

describe('datePresetRange', () => {
  it('computes preset ranges accurately', () => {
    expect(datePresetRange('today', '2026-11-25')).toEqual({
      from: '2026-11-25',
      to: '2026-11-25',
    })
    expect(datePresetRange('yesterday', '2026-11-25')).toEqual({
      from: '2026-11-24',
      to: '2026-11-24',
    })
    expect(datePresetRange('last_7_days', '2026-11-25')).toEqual({
      from: '2026-11-19',
      to: '2026-11-25',
    })
    expect(datePresetRange('this_month', '2026-11-25')).toEqual({
      from: '2026-11-01',
      to: '2026-11-25',
    })
    expect(datePresetRange('last_month', '2026-11-25')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
  })
})

describe('buildCsv', () => {
  it('prepends UTF-8 BOM and escapes commas/quotes', () => {
    const csv = buildCsv(['Tên', 'Ghi chú'], [['Chị Hoa', 'Trả "nợ", đợt 1']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"Trả ""nợ"", đợt 1"')
  })
})

describe('matchesReminderFilter and sortDebtors', () => {
  it('filters by promised pay date and reminder state', () => {
    const today = '2026-11-25'
    const unscheduled = makeAccount({ promised_pay_on: null, last_reminded_at: null })
    const overdue = makeAccount({
      promised_pay_on: '2026-11-20',
      last_reminded_at: '2026-11-18T00:00:00Z',
    })
    const dueToday = makeAccount({ promised_pay_on: '2026-11-25' })
    const upcoming = makeAccount({ promised_pay_on: '2026-12-01' })

    expect(matchesReminderFilter(unscheduled, 'unscheduled', today)).toBe(true)
    expect(matchesReminderFilter(unscheduled, 'never_reminded', today)).toBe(true)
    expect(matchesReminderFilter(overdue, 'overdue', today)).toBe(true)
    expect(matchesReminderFilter(overdue, 'never_reminded', today)).toBe(false)
    expect(matchesReminderFilter(dueToday, 'today', today)).toBe(true)
    expect(matchesReminderFilter(upcoming, 'upcoming', today)).toBe(true)
  })

  it('sorts debtors by balance, overdue, and name', () => {
    const a = makeAccount({
      credit_account_id: 'a',
      balance: '200000',
      days_overdue: 10,
      customer: { id: '1', name: 'Cường', phone: null },
    })
    const b = makeAccount({
      credit_account_id: 'b',
      balance: '900000',
      days_overdue: 2,
      customer: { id: '2', name: 'An', phone: null },
    })

    expect(sortDebtors([a, b], 'balance').map((r) => r.credit_account_id)).toEqual(['b', 'a'])
    expect(sortDebtors([a, b], 'overdue').map((r) => r.credit_account_id)).toEqual(['a', 'b'])
    expect(sortDebtors([a, b], 'name').map((r) => r.credit_account_id)).toEqual(['b', 'a'])
  })
})
