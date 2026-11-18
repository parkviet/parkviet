import { useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { clockToMinutes, type TimedPromotion, type TimedWindow } from '../lib/rate-plans'
import { useSession } from './use-session'

export type EmenuSettings = {
  brand_color: string
  text_color: string
  button_color: string
  banner_enabled: boolean
  banner_promotion_ids: string[]
  best_sellers_enabled: boolean
  best_sellers_source: 'manual' | 'auto'
  best_seller_item_ids: string[]
  best_sellers_limit: number
  best_sellers_auto_ids: string[]
  new_items_enabled: boolean
  new_item_ids: string[]
  min_order_interval_seconds: number
  paused: boolean
  payment_timing: 'pay_after' | 'pay_before'
  pay_methods: Array<'vietqr' | 'counter'>
  prepay_timeout_minutes: number
  vietqr_timeout_minutes: number
  vietqr_available: boolean
  logo_url: string | null
  // The branch's shop name, read only; the sticker may print its own.
  store_name: string
  sticker_show_logo: boolean
  sticker_show_name: boolean
  sticker_store_name: string
  sticker_wifi_enabled: boolean
  sticker_wifi_name: string
  sticker_wifi_password: string
  sticker_greeting: string
  sticker_size: '60' | '80' | '100' | 'custom'
  sticker_custom_mm: number
}

export type EmenuCategoryDraft = {
  id?: string
  name: string
  color: string
  image_url: string | null
  items: string[]
}

export type PromotionPhase = 'running' | 'upcoming' | 'ended'

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const flag = (value: unknown, fallback = false) =>
  value === true || value === false ? value : fallback
const number = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isInteger(value) ? value : fallback
const ids = (value: unknown) =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []

export function readEmenuSettings(value: unknown): EmenuSettings {
  const source = (typeof value === 'object' && value ? value : {}) as Record<string, unknown>
  const methods = ids(source.pay_methods).filter(
    (method): method is 'vietqr' | 'counter' => method === 'vietqr' || method === 'counter',
  )
  const size = source.sticker_size
  return {
    brand_color: text(source.brand_color, '#0b6e4f'),
    text_color: text(source.text_color, '#1d1d1f'),
    button_color: text(source.button_color, '#0b6e4f'),
    banner_enabled: flag(source.banner_enabled),
    banner_promotion_ids: ids(source.banner_promotion_ids),
    best_sellers_enabled: flag(source.best_sellers_enabled),
    best_sellers_source: source.best_sellers_source === 'auto' ? 'auto' : 'manual',
    best_seller_item_ids: ids(source.best_seller_item_ids),
    best_sellers_limit: number(source.best_sellers_limit, 8),
    best_sellers_auto_ids: ids(source.best_sellers_auto_ids),
    new_items_enabled: flag(source.new_items_enabled),
    new_item_ids: ids(source.new_item_ids),
    min_order_interval_seconds: number(source.min_order_interval_seconds, 0),
    paused: flag(source.paused),
    payment_timing: source.payment_timing === 'pay_before' ? 'pay_before' : 'pay_after',
    pay_methods: methods.length > 0 ? methods : ['vietqr', 'counter'],
    prepay_timeout_minutes: number(source.prepay_timeout_minutes, 10),
    vietqr_timeout_minutes: number(source.vietqr_timeout_minutes, 15),
    vietqr_available: source.vietqr_available === true,
    logo_url: text(source.logo_url) || null,
    store_name: text(source.store_name),
    sticker_show_logo: flag(source.sticker_show_logo, true),
    sticker_show_name: flag(source.sticker_show_name, true),
    sticker_store_name: text(source.sticker_store_name),
    sticker_wifi_enabled: flag(source.sticker_wifi_enabled),
    sticker_wifi_name: text(source.sticker_wifi_name),
    sticker_wifi_password: text(source.sticker_wifi_password),
    sticker_greeting: text(source.sticker_greeting, 'Quét mã để gọi món/gọi nhân viên'),
    sticker_size:
      size === '60' || size === '80' || size === '100' || size === 'custom' ? size : '80',
    sticker_custom_mm: number(source.sticker_custom_mm, 80),
  }
}

export function readEmenuCategory(entry: unknown): EmenuCategoryDraft | null {
  const row = (typeof entry === 'object' && entry ? entry : {}) as Record<string, unknown>
  const name = text(row.name).trim()
  if (!name) return null
  const items = Array.isArray(row.items)
    ? row.items.flatMap((item) => {
        if (typeof item === 'string') return [item]
        const placed = (typeof item === 'object' && item ? item : {}) as Record<string, unknown>
        return typeof placed.menu_item_id === 'string' ? [placed.menu_item_id] : []
      })
    : []
  return {
    id: text(row.id) || undefined,
    name,
    color: text(row.color),
    image_url: text(row.image_url) || null,
    items,
  }
}

export function readEmenuMenu(value: unknown): EmenuCategoryDraft[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const category = readEmenuCategory(entry)
    return category ? [category] : []
  })
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function zonedClock(now: Date, timeZone: string): { day: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
    const part = (type: string) => parts.find((row) => row.type === type)?.value ?? ''
    const day = WEEKDAYS[part('weekday')] ?? now.getDay()
    const hour = Number(part('hour'))
    const min = Number(part('minute'))
    return {
      day,
      minute: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(min) ? min : 0),
    }
  } catch {
    return { day: now.getDay(), minute: now.getHours() * 60 + now.getMinutes() }
  }
}

function inTimedWindow(windows: readonly TimedWindow[], now: Date, timeZone: string): boolean {
  const { day, minute } = zonedClock(now, timeZone)
  const yesterday = (day + 6) % 7
  return windows.some((window) => {
    const start = clockToMinutes(window.from)
    const end = clockToMinutes(window.to)
    if (start === null || end === null || start === end || !Array.isArray(window.days)) return false
    if (end > start) return window.days.includes(day) && minute >= start && minute < end
    return (
      (window.days.includes(day) && minute >= start) ||
      (window.days.includes(yesterday) && minute < end)
    )
  })
}

export function promotionPhase(
  promo: Pick<TimedPromotion, 'status' | 'active_windows'> & {
    starts_at?: string | null
    ends_at?: string | null
  },
  now = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
): PromotionPhase {
  if (promo.status !== 'active') return 'ended'
  const endsAt = promo.ends_at ? Date.parse(promo.ends_at) : Number.NaN
  if (!Number.isNaN(endsAt) && endsAt <= now.getTime()) return 'ended'
  const startsAt = promo.starts_at ? Date.parse(promo.starts_at) : Number.NaN
  if (!Number.isNaN(startsAt) && startsAt > now.getTime()) return 'upcoming'
  if (!promo.active_windows || promo.active_windows.length === 0) return 'running'
  return inTimedWindow(promo.active_windows, now, timeZone) ? 'running' : 'upcoming'
}

export function uploadEmenuCategoryImage(branchId: string, categoryId: string, file: File) {
  const form = new FormData()
  form.append('branch_id', branchId)
  form.append('category_id', categoryId)
  form.append('image', file)
  return posRequest<{ data?: unknown }>('POST', '/pos/emenu_menu/image', { body: form })
}

export function useEmenuSettings(branchId: string) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'emenu-settings', branchId),
    queryFn: async () =>
      readEmenuSettings(
        (
          await posRequest<{ data?: unknown }>('GET', '/pos/emenu_settings', {
            params: { branch_id: branchId },
          })
        ).data,
      ),
  })
}

export function useEmenuMenu(branchId: string) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'emenu-menu', branchId),
    queryFn: async () =>
      readEmenuMenu(
        (
          await posRequest<{ data?: unknown }>('GET', '/pos/emenu_menu', {
            params: { branch_id: branchId },
          })
        ).data,
      ),
  })
}

export function useEmenuRefresh(branchId: string) {
  const { storeId } = useSession()
  const client = useQueryClient()
  return () =>
    client.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return (
          Array.isArray(key) &&
          key[0] === 'pos' &&
          key[1] === storeId &&
          String(key[2]).startsWith('emenu') &&
          key.includes(branchId)
        )
      },
    })
}
