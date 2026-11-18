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
  'inline_variants',
  'scheduled_delivery',
  'auto_print_prebill',
  'print_void_tickets',
  'auto_print_ready_ticket',
  'allow_sheet_receipts',
] as const;

export type SalesSettingKey = (typeof SALES_SETTING_KEYS)[number];
export type CartOrder = 'newest_first' | 'oldest_first';
export type PaymentChime = 'off' | 'default';

export type SalesSettings = {
  allow_oversell: boolean;
  warn_below_cost: boolean;
  show_stock: boolean;
  show_cost: boolean;
  cart_order: CartOrder;
  order_note: boolean;
  coupons: boolean;
  payment_chime: PaymentChime;
  auto_print_receipt: boolean;
  inline_variants: boolean;
  scheduled_delivery: boolean;
  auto_print_prebill: boolean;
  print_void_tickets: boolean;
  auto_print_ready_ticket: boolean;
  allow_sheet_receipts: boolean;
};

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
  inline_variants: false,
  scheduled_delivery: false,
  auto_print_prebill: false,
  print_void_tickets: true,
  auto_print_ready_ticket: false,
  allow_sheet_receipts: true,
};

const CART_ORDERS: readonly CartOrder[] = ['newest_first', 'oldest_first'];
const CHIMES: readonly PaymentChime[] = ['off', 'default'];

function flag(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeSalesSettings(value: unknown): SalesSettings {
  const source =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const cart = source.cart_order;
  const chime = source.payment_chime;
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
    inline_variants: flag(source.inline_variants, SALES_SETTING_DEFAULTS.inline_variants),
    scheduled_delivery: flag(source.scheduled_delivery, SALES_SETTING_DEFAULTS.scheduled_delivery),
    auto_print_prebill: flag(source.auto_print_prebill, SALES_SETTING_DEFAULTS.auto_print_prebill),
    print_void_tickets: flag(source.print_void_tickets, SALES_SETTING_DEFAULTS.print_void_tickets),
    auto_print_ready_ticket: flag(
      source.auto_print_ready_ticket,
      SALES_SETTING_DEFAULTS.auto_print_ready_ticket,
    ),
    allow_sheet_receipts: flag(
      source.allow_sheet_receipts,
      SALES_SETTING_DEFAULTS.allow_sheet_receipts,
    ),
  };
}
