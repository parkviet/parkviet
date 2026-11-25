// Pure finance utilities: TT152/2025/TT-BTC voucher categories, Vietnamese
// amount-in-words for printed vouchers, date presets, UTF-8 BOM CSV export,
// and debtor reminder/sorting helpers.

import type { PosReceivableAccount } from './types/pos-context'

export const INCOME_CATEGORIES = [
  'debt_collection',
  'sales_other',
  'capital_contribution',
  'loan_interest',
  'supplier_refund',
  'other_income',
] as const

export const EXPENSE_CATEGORIES = [
  'purchase_goods',
  'debt_payment',
  'labor_cost',
  'electricity',
  'water',
  'telecom',
  'rent',
  'management',
  'social_insurance',
  'health_insurance',
  'unemployment_insurance',
  'vat_tax',
  'pit_tax',
  'shipping',
  'asset_rent',
  'maintenance',
  'interest_expense',
  'depreciation',
  'other_expense',
] as const

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type VoucherCategory = IncomeCategory | ExpenseCategory | 'internal_transfer'

export const DATE_PRESETS = [
  'today',
  'yesterday',
  'last_7_days',
  'this_month',
  'last_month',
  'this_year',
] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export function datePresetRange(
  preset: DatePreset,
  todayIso: string,
): { from: string; to: string } {
  const [y, m, d] = todayIso.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
  const shift = (days: number) => {
    const copy = new Date(base.getTime())
    copy.setUTCDate(copy.getUTCDate() + days)
    return copy
  }
  switch (preset) {
    case 'today':
      return { from: todayIso, to: todayIso }
    case 'yesterday': {
      const yest = fmt(shift(-1))
      return { from: yest, to: yest }
    }
    case 'last_7_days':
      return { from: fmt(shift(-6)), to: todayIso }
    case 'this_month':
      return { from: fmt(new Date(Date.UTC(y, m - 1, 1))), to: todayIso }
    case 'last_month': {
      const first = new Date(Date.UTC(y, m - 2, 1))
      const last = new Date(Date.UTC(y, m - 1, 0))
      return { from: fmt(first), to: fmt(last) }
    }
    case 'this_year':
      return { from: fmt(new Date(Date.UTC(y, 0, 1))), to: todayIso }
  }
}

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const UNITS = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ']

function readThreeDigits(n: number, showZeroHundred: boolean): string {
  const hundred = Math.floor(n / 100)
  const ten = Math.floor((n % 100) / 10)
  const one = n % 10
  const parts: string[] = []

  if (hundred > 0 || showZeroHundred) {
    parts.push(`${DIGITS[hundred]} trăm`)
  }
  if (ten > 1) {
    parts.push(`${DIGITS[ten]} mươi`)
    if (one === 1) parts.push('mốt')
    else if (one === 5) parts.push('lăm')
    else if (one > 0) parts.push(DIGITS[one])
  } else if (ten === 1) {
    parts.push('mười')
    if (one === 5) parts.push('lăm')
    else if (one > 0) parts.push(DIGITS[one])
  } else if (one > 0) {
    if (hundred > 0 || showZeroHundred) parts.push('lẻ')
    parts.push(DIGITS[one])
  }
  return parts.join(' ')
}

export function vndToWords(raw: string | number): string {
  const num = Math.round(Math.abs(Number(raw) || 0))
  if (num === 0) return 'Không đồng'
  const groups: number[] = []
  let rem = num
  while (rem > 0) {
    groups.push(rem % 1000)
    rem = Math.floor(rem / 1000)
  }
  const chunks: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const val = groups[i]
    if (val === 0) continue
    const showZeroHundred = i < groups.length - 1
    chunks.push(`${readThreeDigits(val, showZeroHundred)}${UNITS[i] ?? ''}`)
  }
  const sentence = `${chunks.join(' ').trim()} đồng`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

export function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))]
  // UTF-8 BOM so Microsoft Excel opens Vietnamese diacritics cleanly.
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const blob = new Blob([buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const REMINDER_FILTERS = [
  'all',
  'unscheduled',
  'overdue',
  'today',
  'upcoming',
  'never_reminded',
] as const
export type ReminderFilter = (typeof REMINDER_FILTERS)[number]

export const DEBTOR_SORTS = ['overdue', 'balance', 'recent', 'name'] as const
export type DebtorSort = (typeof DEBTOR_SORTS)[number]

export function matchesReminderFilter(
  account: PosReceivableAccount,
  filter: ReminderFilter,
  todayIso: string,
): boolean {
  if (filter === 'all') return true
  if (filter === 'never_reminded') return !account.last_reminded_at
  const promised = account.promised_pay_on
  if (filter === 'unscheduled') return !promised
  if (!promised) return false
  if (filter === 'overdue') return promised < todayIso
  if (filter === 'today') return promised === todayIso
  if (filter === 'upcoming') return promised > todayIso
  return true
}

export function sortDebtors(
  rows: readonly PosReceivableAccount[],
  sort: DebtorSort,
): PosReceivableAccount[] {
  const copy = [...rows]
  copy.sort((a, b) => {
    switch (sort) {
      case 'balance':
        return Number(b.balance) - Number(a.balance)
      case 'recent':
        return (b.last_activity_at ?? b.oldest_placed_at ?? '').localeCompare(
          a.last_activity_at ?? a.oldest_placed_at ?? '',
        )
      case 'name':
        return a.customer.name.localeCompare(b.customer.name, 'vi')
      default: {
        const diff = (b.days_overdue ?? 0) - (a.days_overdue ?? 0)
        return diff !== 0 ? diff : Number(b.balance) - Number(a.balance)
      }
    }
  })
  return copy
}
