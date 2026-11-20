// The guest API's shapes (server/openapi/pos-guest.yaml).

export type GuestSession = {
  id: string;
  status: 'open' | 'table_closed';
  expires_at: string;
  table: { name: string; kind: string };
  branch: { name: string; store_name: string };
  currency: string;
  approval: 'staff_approval' | 'direct_to_kitchen';
  // A room billed by play time: the bill adds the time played.
  timed: boolean;
  paused: boolean;
};

// A tab of the guest menu: a Spree category of the counter's menu, or an
// electronic-menu category when the branch has one (only those carry a
// colour and a picture).
export type GuestCategory = {
  id: string;
  name: string;
  position: number;
  color: string | null;
  image_url?: string | null;
};

export type MenuVariant = {
  id: string;
  name: string | null;
  price: string;
  price_label: string | null;
};

// One product a guest may order; `id` is the product's id. On the counter's
// menu `category_ids` are its Spree categories (none shows it under "All"
// only) and `position` its place on the counter; on an electronic menu a
// product placed in two categories is two rows, each with its one category
// and its place in it.
export type GuestItem = {
  id: string;
  name: string;
  kind: 'single' | 'combo';
  category_ids: string[];
  position: number;
  image_url: string | null;
  sold_out: boolean;
  modifier_group_ids: string[];
  components: { name: string; quantity: number }[];
  variants: MenuVariant[];
};

export type ModifierOption = {
  id: string;
  name: string;
  price_delta: string;
  default_selected: boolean;
};

export type ModifierGroup = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  allow_quantity: boolean;
  required: boolean;
  options: ModifierOption[];
};

export type GuestTheme = {
  brand_color: string;
  text_color: string;
  button_color: string;
  logo_url: string | null;
  store_name: string;
};

export type GuestMenu = {
  currency: string;
  etag: string;
  categories: GuestCategory[];
  items: GuestItem[];
  modifier_groups: ModifierGroup[];
  theme?: GuestTheme;
  sections?: {
    banner: { id: string; name: string }[];
    best_sellers: string[];
    new_items: string[];
  };
  payment?: {
    timing: 'pay_after' | 'pay_before';
    methods: Array<'vietqr' | 'counter'>;
    vietqr_available: boolean;
  };
};

export type PaymentQr = {
  payload: string;
  amount: string;
  currency: string;
  transfer_content: string;
  bank_bin?: string;
  bank_name?: string | null;
  account_number?: string;
  account_name?: string | null;
  image_url?: string | null;
  due?: string;
};

export type GuestOrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'canceled';

export type GuestOrder = {
  id: string;
  status: GuestOrderStatus;
  reject_reason: string | null;
  items: {
    name: string;
    size: string | null;
    quantity: number;
    amount: string;
    note?: string | null;
    outcome?: 'added' | 'left_out' | null;
    options: string[];
  }[];
  quoted_total: string;
  currency: string;
  created_at: string;
  payment?: {
    method: 'vietqr' | 'counter';
    expires_at: string | null;
    qr: PaymentQr | null;
  } | null;
};

export type GuestRequest = {
  id: string;
  kind: 'call_staff' | 'request_bill';
  status: 'open' | 'done';
  created_at: string;
};

export type TableLine = {
  name: string;
  size: string | null;
  quantity: string;
  options: string[];
  amount: string;
  kitchen: 'waiting' | 'sent' | 'preparing' | 'ready' | 'served';
};

export type GuestTable = {
  lines: TableLine[];
  subtotal: string | null;
  paid?: string;
  due?: string;
  has_timed: boolean;
  orders: GuestOrder[];
  requests: GuestRequest[];
};
