// A branch menu for the retail API fixture: the products the branch sells,
// keyed by product, with their Spree categories, option groups, sold-out
// marks and a time-of-day price. A prepared product prices the way the
// server prices menu lines (base or scheduled price plus the options; the
// client sends no price); any other product is an ordinary line.
// Presentation fixtures only: no real account privileges.

export type MenuOptionFixture = { id: string; name: string; delta: number; default?: boolean };
export type MenuGroupFixture = {
  id: string;
  name: string;
  min: number;
  max: number;
  allowQuantity?: boolean;
  options: MenuOptionFixture[];
};
export type MenuProductFixture = {
  productId: string;
  variantId: string;
  name: string;
  price: number;
  // Spree categories the product is attached to directly; none shows it under "All" only.
  categoryIds: string[];
  groupIds: string[];
  // The POS kind of the product; only a prepared product is a menu line. Prepared when absent.
  productKind?: 'goods' | 'prepared' | 'service' | null;
  // A running time-of-day menu's price for this product.
  scheduledPrice?: number;
};

export type CategoryFixture = { id: string; name: string; parentId?: string };

export type MenuWorld = {
  items: MenuProductFixture[];
  categories: CategoryFixture[];
  groups: MenuGroupFixture[];
  // Product ids sold out today.
  soldOut: Set<string>;
  // Product ids of the favourites row.
  favorites: string[];
};

export type MenuLine = {
  // The base or scheduled price the line was first sold at; a change of options keeps it.
  basePrice: number;
  unitPrice: number;
  note: string | null;
  signature: string;
  modifiers: Array<{ id: string; option_id: string; name: string; group_name: string; price_delta: string; quantity: number }>;
};

const money = (value: number) => `${value}.0`;

export function teaMenu(): MenuWorld {
  return {
    items: [
      { productId: 'prod_tea', variantId: 'v_tea', name: 'Trà sữa', price: 30000, categoryIds: ['ctg_tea'], groupIds: ['posmodgroup_sugar', 'posmodgroup_topping'] },
      { productId: 'prod_peach', variantId: 'v_peach', name: 'Trà đào', price: 35000, categoryIds: ['ctg_tea'], groupIds: [], scheduledPrice: 25000 },
      { productId: 'prod_flan', variantId: 'v_flan', name: 'Bánh flan', price: 15000, categoryIds: ['ctg_cake'], groupIds: [] },
    ],
    categories: [
      { id: 'ctg_tea', name: 'Trà' },
      { id: 'ctg_cake', name: 'Bánh' },
    ],
    groups: [
      {
        id: 'posmodgroup_sugar', name: 'Đường', min: 1, max: 1,
        options: [
          { id: 'posmodopt_half', name: '50% đường', delta: 0 },
          { id: 'posmodopt_full', name: '100% đường', delta: 0, default: true },
        ],
      },
      {
        id: 'posmodgroup_topping', name: 'Topping', min: 0, max: 3, allowQuantity: true,
        options: [
          { id: 'posmodopt_pearl', name: 'Trân châu', delta: 5000 },
          { id: 'posmodopt_jelly', name: 'Thạch', delta: 4000 },
        ],
      },
    ],
    soldOut: new Set(),
    favorites: ['prod_peach', 'prod_tea'],
  };
}

export function menuProductByVariant(menu: MenuWorld, variantId: string) {
  return menu.items.find((item) => item.variantId === variantId);
}

// The branch runs the menu, so a prepared product sells as a menu line.
export function sellsAsMenuLine(item: MenuProductFixture) {
  return (item.productKind ?? 'prepared') === 'prepared';
}

export function menuBody(menu: MenuWorld) {
  return {
    branch_id: 'br_1',
    currency: 'VND',
    business_date: '2026-11-11',
    module_enabled: true,
    // Only the categories with a listed product attached directly, as the server lists them.
    categories: menu.categories
      .filter((category) => menu.items.some((item) => item.categoryIds.includes(category.id)))
      .map((category, position) => ({ id: category.id, name: category.name, position, parent_id: category.parentId ?? null })),
    items: menu.items.map((item) => ({
      product_id: item.productId, name: item.name, product_kind: item.productKind === undefined ? 'prepared' : item.productKind,
      kind: 'single', category_ids: item.categoryIds, kitchen_category: null, cup_label: false, show_components_on_kds: false,
      qr_orderable: sellsAsMenuLine(item), drink_credit: null, drink_credit_categories: [], tax_category_id: null,
      modifier_group_ids: sellsAsMenuLine(item) ? item.groupIds : [], components: [], image_url: null,
      sold_out: menu.soldOut.has(item.productId),
      variants: [{
        id: item.variantId, name: null, sku: item.productId.toUpperCase(), barcode: null,
        price: money(item.scheduledPrice ?? item.price), list_price: money(item.price),
        schedule_id: item.scheduledPrice === undefined ? null : 'posmenusched_golden',
      }],
    })),
    modifier_groups: menu.groups.map((group, position) => ({
      id: group.id, name: group.name, min_select: group.min, max_select: group.max, allow_quantity: group.allowQuantity === true,
      required: group.min > 0, position,
      options: group.options.map((option, index) => ({
        id: option.id, name: option.name, price_delta: money(option.delta), variant_id: null,
        default_selected: option.default === true, position: index, active: true,
      })),
    })),
    schedules: menu.items.some((item) => item.scheduledPrice !== undefined) ? [{ id: 'posmenusched_golden', name: 'Giờ vàng' }] : [],
    favorites: menu.favorites,
    etag: `menu-${[...menu.soldOut].sort().join(',')}`,
  };
}

type Refusal = { refused: string; reason: string };

// Prices one menu add. Absent `modifiers` take the defaults; `[]` takes none.
export function priceMenuAdd(
  menu: MenuWorld,
  item: MenuProductFixture,
  body: Record<string, unknown>,
): MenuLine | Refusal {
  if (menu.soldOut.has(item.productId)) return { refused: 'This product is sold out today.', reason: 'product_sold_out' };
  if (body.price_override !== undefined) return { refused: 'The menu sets the price.', reason: 'menu_price_fixed' };
  const groups = menu.groups.filter((group) => item.groupIds.includes(group.id));
  const sent = body.modifiers as Array<{ option_id: string; quantity?: number }> | undefined;
  const picks = new Map<string, number>();
  if (sent === undefined) {
    for (const group of groups) for (const option of group.options) if (option.default) picks.set(option.id, 1);
  } else {
    for (const row of sent) picks.set(row.option_id, (picks.get(row.option_id) ?? 0) + (row.quantity ?? 1));
  }
  const modifiers: MenuLine['modifiers'] = [];
  const basePrice = item.scheduledPrice ?? item.price;
  let unitPrice = basePrice;
  for (const [optionId, quantity] of picks) {
    const group = groups.find((row) => row.options.some((option) => option.id === optionId));
    const option = group?.options.find((row) => row.id === optionId);
    if (!group || !option) return { refused: 'Unknown option.', reason: 'modifier_unknown' };
    unitPrice += option.delta * quantity;
    modifiers.push({
      id: `poslinemod_${optionId}`, option_id: optionId, name: option.name, group_name: group.name,
      price_delta: money(option.delta), quantity,
    });
  }
  for (const group of groups) {
    const count = group.options.reduce((sum, option) => sum + (group.allowQuantity ? (picks.get(option.id) ?? 0) : picks.has(option.id) ? 1 : 0), 0);
    if (count < group.min) return { refused: `${group.name} needs a pick.`, reason: 'modifier_min' };
    if (count > group.max) return { refused: `${group.name} has too many picks.`, reason: 'modifier_max' };
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  const signature = [...picks.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([id, quantity]) => `${id}:${quantity}`).join(',') + `|${(note ?? '').toLowerCase()}`;
  return { basePrice, unitPrice, note, signature, modifiers };
}

export function isRefusal(value: MenuLine | Refusal): value is Refusal {
  return 'refused' in value;
}
