// Per-branch selling options. Missing or malformed values read as the default,
// so an older server (or a branch saved before a key existed) stays usable.
// Unknown keys are ignored on read; the server rejects them on write.

export const SALES_SETTING_KEYS = [
  'allow_oversell',
  'warn_below_cost',
  'show_stock',
  'show_cost',
  'cart_order',
  'order_note',
  'coupons',
  'payment_chime',
  'auto_print_receipt',
] as const

export type SalesSettingKey = (typeof SALES_SETTING_KEYS)[number]
export type CartOrder = 'newest_first' | 'oldest_first'
export type PaymentChime = 'off' | 'default'

export type SalesSettings = {
  allow_oversell: boolean
  warn_below_cost: boolean
  show_stock: boolean
  show_cost: boolean
  cart_order: CartOrder
  order_note: boolean
  coupons: boolean
  payment_chime: PaymentChime
  auto_print_receipt: boolean
}

export const SALES_SETTING_DEFAULTS: SalesSettings = {
  allow_oversell: true,
  warn_below_cost: false,
  show_stock: true,
  show_cost: false,
  cart_order: 'oldest_first',
  order_note: true,
  coupons: true,
  payment_chime: 'default',
  auto_print_receipt: false,
}

const CART_ORDERS: readonly CartOrder[] = ['newest_first', 'oldest_first']
const CHIMES: readonly PaymentChime[] = ['off', 'default']

function flag(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeSalesSettings(value: unknown): SalesSettings {
  const source =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const cart = source.cart_order
  const chime = source.payment_chime
  return {
    allow_oversell: flag(source.allow_oversell, SALES_SETTING_DEFAULTS.allow_oversell),
    warn_below_cost: flag(source.warn_below_cost, SALES_SETTING_DEFAULTS.warn_below_cost),
    show_stock: flag(source.show_stock, SALES_SETTING_DEFAULTS.show_stock),
    show_cost: flag(source.show_cost, SALES_SETTING_DEFAULTS.show_cost),
    cart_order: CART_ORDERS.includes(cart as CartOrder)
      ? (cart as CartOrder)
      : SALES_SETTING_DEFAULTS.cart_order,
    order_note: flag(source.order_note, SALES_SETTING_DEFAULTS.order_note),
    coupons: flag(source.coupons, SALES_SETTING_DEFAULTS.coupons),
    payment_chime: CHIMES.includes(chime as PaymentChime)
      ? (chime as PaymentChime)
      : SALES_SETTING_DEFAULTS.payment_chime,
    auto_print_receipt: flag(source.auto_print_receipt, SALES_SETTING_DEFAULTS.auto_print_receipt),
  }
}
