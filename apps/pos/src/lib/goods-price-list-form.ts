import type { PriceBulkUpsertRowParams, PriceListRuleParams } from '@spree/admin-sdk'

// The price lists screen: a list's state as the tabs count it, how it prices,
// which channels it is on, its form values and the Spree payload they make.
// A Spree price list has no code or metadata field, so the POS code is the
// list's `description`.

export const CODE_PREFIX = 'BG'
export const CODE_MAX = 32
const CODE_PATTERN = /^[A-Za-z0-9._-]+$/

type RuleSlice = {
  id?: string
  type: string
  preferences: Record<string, unknown>
  channels?: { id: string; name: string; code?: string }[]
}
export type ScreenList = {
  id: string
  name: string
  description: string | null
  status: string
  starts_at: string | null
  ends_at: string | null
  price_rules?: RuleSlice[]
}

export const PRICE_LIST_STATES = ['active', 'pending', 'paused', 'expired'] as const
export type PriceListState = (typeof PRICE_LIST_STATES)[number]

// Expired once its end has passed, whatever its status; a switched-off list
// is paused; a draft or a list whose start is ahead is not applied yet.
export function priceListState(list: ScreenList, now: Date): PriceListState {
  const time = now.getTime()
  if (list.ends_at && new Date(list.ends_at).getTime() < time) return 'expired'
  if (list.status === 'inactive') return 'paused'
  if (list.status === 'draft') return 'pending'
  if (list.starts_at && new Date(list.starts_at).getTime() > time) return 'pending'
  return 'active'
}

export function stateCounts(lists: readonly ScreenList[], now: Date) {
  const counts: Record<PriceListState | 'all', number> = {
    all: lists.length,
    active: 0,
    pending: 0,
    paused: 0,
    expired: 0,
  }
  for (const list of lists) counts[priceListState(list, now)] += 1
  return counts
}

// A list in effect or waiting for its dates can be paused; any other can be
// switched on (Spree schedules one whose start is ahead).
export const canPause = (list: ScreenList) =>
  list.status === 'active' || list.status === 'scheduled'

export type PricingMethod = 'fixed' | 'formula' | 'volume'
const rule = (list: Pick<ScreenList, 'price_rules'>, type: string) =>
  (list.price_rules ?? []).find((item) => item.type === type)

// A list with a volume rule sells wholesale; any other charges fixed prices.
// A formula only fills prices in, so a saved list reads as fixed.
export const pricingMethodOf = (list: Pick<ScreenList, 'price_rules'>): PricingMethod =>
  rule(list, 'volume_rule') ? 'volume' : 'fixed'

const idList = (value: unknown) =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []

// The channels a list is limited to, empty when it applies on every channel.
export function listChannels(list: Pick<ScreenList, 'price_rules'>) {
  const channel = rule(list, 'channel_rule')
  if (!channel) return []
  const named = new Map((channel.channels ?? []).map((row) => [row.id, row.name]))
  return idList(channel.preferences.channel_ids).map((id) => ({ id, name: named.get(id) ?? id }))
}

// The code shown for a list: its description when that is a code.
export const listCode = (list: Pick<ScreenList, 'description'>) => {
  const text = list.description?.trim() ?? ''
  return text.length <= CODE_MAX && CODE_PATTERN.test(text) ? text : ''
}

// The next free generated code: the prefix and six digits after the highest.
export function nextListCode(lists: readonly Pick<ScreenList, 'description'>[]) {
  const pattern = new RegExp(`^${CODE_PREFIX}(\\d{6})$`)
  let highest = 0
  for (const list of lists) {
    const match = pattern.exec(listCode(list))
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return `${CODE_PREFIX}${String(highest + 1).padStart(6, '0')}`
}

// --- Dates: a list starts at the beginning and ends at the end of a day where
// the store trades (Spree compares the dates in the store's time zone).

function zoneOffset(at: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(at))
      .map((part) => [part.type, part.value]),
  )
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return wall - Math.floor(at / 1000) * 1000
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
// The instant a day starts (or its last second) in a time zone, as ISO.
export function zonedInstant(day: string, edge: 'start' | 'end', timeZone: string) {
  const match = DAY.exec(day)
  if (!match) return null
  const [, year, month, date] = match.map(Number)
  const wall =
    edge === 'start' ? Date.UTC(year, month - 1, date) : Date.UTC(year, month - 1, date, 23, 59, 59)
  if (Number.isNaN(wall)) return null
  const first = wall - zoneOffset(wall, timeZone)
  return new Date(wall - zoneOffset(first, timeZone)).toISOString()
}

// The day an instant falls on in a time zone, as YYYY-MM-DD.
export function zonedDay(value: string | Date, timeZone: string) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// --- Formula: a price derived from the selling price, rounded to the
// currency's minor unit. Null when it is not a usable price.

export type Formula = {
  direction: 'increase' | 'decrease'
  kind: 'percent' | 'amount'
  value: string
}
export const minorDigits = (currency: string) => (currency === 'VND' ? 0 : 2)

export function formulaValueValid(formula: Formula) {
  const value = Number(formula.value)
  if (!/^\d+(?:\.\d+)?$/.test(formula.value.trim()) || !(value > 0)) return false
  return formula.kind === 'amount' || formula.direction === 'increase' || value < 100
}

export function formulaPrice(base: string | null, formula: Formula, currency: string) {
  if (base === null || !/^-?\d+(?:\.\d+)?$/.test(base) || !formulaValueValid(formula)) return null
  const amount = Number(base)
  const value = Number(formula.value)
  const sign = formula.direction === 'increase' ? 1 : -1
  const raw =
    formula.kind === 'percent' ? amount * (1 + (sign * value) / 100) : amount + sign * value
  const scale = 10 ** minorDigits(currency)
  const rounded = Math.round(raw * scale) / scale
  return rounded >= 0 ? rounded.toFixed(minorDigits(currency)) : null
}

// --- Form values and the payload they make.

export type Audience = 'all' | 'groups'
export type PriceListFormValues = {
  code: string
  name: string
  startsOn: string
  endsOn: string
  noEnd: boolean
  audience: Audience
  channelIds: string[]
  groupIds: string[]
  method: PricingMethod
  formula: Formula
  minQuantity: string
  maxQuantity: string
}

export const emptyFormula = (): Formula => ({ direction: 'decrease', kind: 'percent', value: '' })

export function newPriceListValues(input: {
  code: string
  today: string
  posChannelId: string | null
}): PriceListFormValues {
  return {
    code: input.code,
    name: '',
    startsOn: input.today,
    endsOn: '',
    noEnd: true,
    audience: 'all',
    channelIds: input.posChannelId ? [input.posChannelId] : [],
    groupIds: [],
    method: 'fixed',
    formula: emptyFormula(),
    minQuantity: '2',
    maxQuantity: '',
  }
}

export function priceListValues(
  list: ScreenList,
  input: { timeZone: string; groupIds: string[] | null },
): PriceListFormValues {
  const volume = rule(list, 'volume_rule')
  const max = volume?.preferences.max_quantity
  return {
    code: listCode(list) || (list.description ?? ''),
    name: list.name,
    startsOn: list.starts_at ? zonedDay(list.starts_at, input.timeZone) : '',
    endsOn: list.ends_at ? zonedDay(list.ends_at, input.timeZone) : '',
    noEnd: !list.ends_at,
    audience: input.groupIds ? 'groups' : 'all',
    channelIds: listChannels(list).map((channel) => channel.id),
    groupIds: input.groupIds ?? [],
    method: pricingMethodOf(list),
    formula: emptyFormula(),
    minQuantity: volume ? String(volume.preferences.min_quantity ?? 1) : '2',
    maxQuantity: typeof max === 'number' ? String(max) : '',
  }
}

export type PriceListFormErrors = Partial<
  Record<
    | 'code'
    | 'name'
    | 'startsOn'
    | 'endsOn'
    | 'groupIds'
    | 'formula'
    | 'minQuantity'
    | 'maxQuantity',
    string
  >
>

const COUNT = /^\d{1,7}$/
export function validatePriceList(values: PriceListFormValues): PriceListFormErrors {
  const errors: PriceListFormErrors = {}
  const code = values.code.trim()
  if (code && (code.length > CODE_MAX || !CODE_PATTERN.test(code))) errors.code = 'code'
  if (!values.name.trim()) errors.name = 'name'
  if (values.startsOn && !DAY.test(values.startsOn)) errors.startsOn = 'date'
  if (!values.noEnd) {
    if (!DAY.test(values.endsOn)) errors.endsOn = 'endRequired'
    else if (values.startsOn && values.endsOn < values.startsOn) errors.endsOn = 'endBeforeStart'
  }
  if (values.audience === 'groups' && values.groupIds.length === 0) errors.groupIds = 'groups'
  if (
    values.method === 'formula' &&
    values.formula.value.trim() &&
    !formulaValueValid(values.formula)
  )
    errors.formula = 'formula'
  if (values.method === 'volume') {
    const min = COUNT.test(values.minQuantity.trim()) ? Number(values.minQuantity) : NaN
    if (!(min >= 1)) errors.minQuantity = 'quantity'
    const rawMax = values.maxQuantity.trim()
    if (rawMax) {
      const max = COUNT.test(rawMax) ? Number(rawMax) : NaN
      if (!(max >= 1)) errors.maxQuantity = 'quantity'
      else if (max < min) errors.maxQuantity = 'maxBelowMin'
    }
  }
  return errors
}

// The list's own attributes and rules. Rules the screen does not manage
// (a market rule set elsewhere) are sent back unchanged, since the payload is
// the complete rule set; managed rules keep their ids. A customer-group list
// is reached through its catalog, which never asks a channel rule, so it gets none.
export function priceListPayload(
  values: PriceListFormValues,
  input: { timeZone: string; existing?: ScreenList; fallbackCode: string },
) {
  const kept = (input.existing?.price_rules ?? []).filter(
    (item) => item.type !== 'channel_rule' && item.type !== 'volume_rule',
  )
  const idOf = (type: string) => input.existing && rule(input.existing, type)?.id
  const rules: PriceListRuleParams[] = kept.map((item) => ({
    ...(item.id ? { id: item.id } : {}),
    type: item.type,
    preferences: item.preferences,
  }))
  if (values.audience === 'all' && values.channelIds.length > 0)
    rules.push({
      ...(idOf('channel_rule') ? { id: idOf('channel_rule') } : {}),
      type: 'channel_rule',
      preferences: { channel_ids: values.channelIds },
    })
  if (values.method === 'volume')
    rules.push({
      ...(idOf('volume_rule') ? { id: idOf('volume_rule') } : {}),
      type: 'volume_rule',
      preferences: {
        min_quantity: Number(values.minQuantity),
        max_quantity: values.maxQuantity.trim() ? Number(values.maxQuantity) : null,
      },
    })
  return {
    name: values.name.trim(),
    description: values.code.trim() || input.fallbackCode,
    starts_at: values.startsOn ? zonedInstant(values.startsOn, 'start', input.timeZone) : null,
    ends_at:
      values.noEnd || !values.endsOn ? null : zonedInstant(values.endsOn, 'end', input.timeZone),
    match_policy: 'all' as const,
    rules,
  }
}

type BottomPrice = {
  id: string
  variant_id: string | null
  price_list_id: string | null
  currency: string | null
  min_quantity: number
}
// The list's own price (quantity 1) of each variant worked out by a formula
// from its selling price. A variant without a usable result is skipped.
export function formulaUpserts(
  variants: readonly { id: string; basePrice: string | null }[],
  prices: readonly BottomPrice[],
  input: { formula: Formula; listId: string; currency: string },
): PriceBulkUpsertRowParams[] {
  return variants.flatMap((variant) => {
    const amount = formulaPrice(variant.basePrice, input.formula, input.currency)
    if (amount === null) return []
    const bottom = prices.find(
      (price) =>
        price.variant_id === variant.id &&
        price.price_list_id === input.listId &&
        price.currency === input.currency &&
        price.min_quantity <= 1,
    )
    return [
      {
        ...(bottom ? { id: bottom.id } : {}),
        variant_id: variant.id,
        currency: input.currency as PriceBulkUpsertRowParams['currency'],
        price_list_id: input.listId,
        amount,
      },
    ]
  })
}
