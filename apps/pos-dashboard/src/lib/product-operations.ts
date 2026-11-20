import type { PosMenuProduct } from '@parkviet/pos-shared/types/pos-context'

// The POS operating data kept beside a Spree product, keyed by its id: the
// kitchen settings, add-on groups and combo contents of a prepared product
// ("Sản phẩm chế biến"). Only a prepared product takes them; the product
// itself is read and written through the Admin API.

// One product's operating data as `PUT /pos/products/:id/...` answers it.
export type ProductPosConfig = Omit<
  PosMenuProduct,
  'category_ids' | 'image_url' | 'sold_out' | 'variants'
>
// A row of `GET /pos/products/settings`: the same, with sizes at list price.
export type ProductPosSettings = ProductPosConfig & {
  variants: { id: string; name: string | null; sku: string | null; price: string | null }[]
}

export type ProductOperations = Pick<
  ProductPosConfig,
  | 'kitchen_category'
  | 'cup_label'
  | 'show_components_on_kds'
  | 'qr_orderable'
  | 'drink_credit'
  | 'drink_credit_categories'
>
// What a product without stored settings reads as on the server.
export const DEFAULT_OPERATIONS: ProductOperations = {
  kitchen_category: null,
  cup_label: false,
  show_components_on_kds: true,
  qr_orderable: true,
  drink_credit: null,
  drink_credit_categories: [],
}

export const operationsOf = (config: ProductOperations | null | undefined): ProductOperations =>
  config
    ? {
        kitchen_category: config.kitchen_category,
        cup_label: config.cup_label,
        show_components_on_kds: config.show_components_on_kds,
        qr_orderable: config.qr_orderable,
        drink_credit: config.drink_credit,
        drink_credit_categories: [...config.drink_credit_categories],
      }
    : { ...DEFAULT_OPERATIONS, drink_credit_categories: [] }

// The "Vận hành" block as typed: text fields stay strings until saved.
export type OperationsFormValues = {
  kitchenCategory: string
  cupLabel: boolean
  showComponentsOnKds: boolean
  qrOrderable: boolean
  // Whole VND per door ticket; empty when the product is not a ticket.
  drinkCredit: string
  // Kitchen categories separated by commas; empty is every drink.
  drinkCreditCategories: string
}

// A stored amount ("100000.0") as typed ("100000").
const wholeAmount = (value: string | null) => value?.replace(/\.0+$/, '') ?? ''

export const operationsForm = (operations: ProductOperations): OperationsFormValues => ({
  kitchenCategory: operations.kitchen_category ?? '',
  cupLabel: operations.cup_label,
  showComponentsOnKds: operations.show_components_on_kds,
  qrOrderable: operations.qr_orderable,
  drinkCredit: wholeAmount(operations.drink_credit),
  drinkCreditCategories: operations.drink_credit_categories.join(', '),
})

// The server's pattern for a kitchen category code.
export const KITCHEN_CATEGORY = /^[a-z_]{2,40}$/
const DRINK_CREDIT = /^[1-9]\d{0,11}$/
const MAX_CREDIT_CATEGORIES = 20

export const splitCategories = (text: string) =>
  text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

export type OperationsField = 'kitchenCategory' | 'drinkCredit' | 'drinkCreditCategories'
// The fields of the block the server would refuse, in form order.
export function operationsProblems(form: OperationsFormValues): OperationsField[] {
  const problems: OperationsField[] = []
  const kitchen = form.kitchenCategory.trim()
  if (kitchen && !KITCHEN_CATEGORY.test(kitchen)) problems.push('kitchenCategory')
  const credit = form.drinkCredit.trim()
  if (credit && !DRINK_CREDIT.test(credit)) problems.push('drinkCredit')
  const categories = splitCategories(form.drinkCreditCategories)
  if (
    categories.length > MAX_CREDIT_CATEGORIES ||
    categories.some((code) => !KITCHEN_CATEGORY.test(code))
  )
    problems.push('drinkCreditCategories')
  return problems
}

// The request body of a valid block.
export const parseOperations = (form: OperationsFormValues): ProductOperations => ({
  kitchen_category: form.kitchenCategory.trim() || null,
  cup_label: form.cupLabel,
  show_components_on_kds: form.showComponentsOnKds,
  qr_orderable: form.qrOrderable,
  drink_credit: form.drinkCredit.trim() || null,
  drink_credit_categories: [...new Set(splitCategories(form.drinkCreditCategories))],
})

const sameAmount = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : Number(a) === Number(b)
export const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

export const sameOperations = (a: ProductOperations, b: ProductOperations) =>
  a.kitchen_category === b.kitchen_category &&
  a.cup_label === b.cup_label &&
  a.show_components_on_kds === b.show_components_on_kds &&
  a.qr_orderable === b.qr_orderable &&
  sameAmount(a.drink_credit, b.drink_credit) &&
  sameIds(a.drink_credit_categories, b.drink_credit_categories)

// ---------------------------------------------------------------------------
// Combo contents

// One content row as edited: a variant of another product and how many.
export type ComboRow = { variantId: string; name: string; quantity: string }
export type ComboComponent = { variant_id: string; quantity: number }
export const MAX_COMBO_QUANTITY = 100

export const comboRows = (components: ProductPosConfig['components']): ComboRow[] =>
  components.map((row) => ({
    variantId: row.variant_id,
    name: row.name,
    quantity: String(row.quantity),
  }))

export const comboQuantityValid = (quantity: string) =>
  /^\d{1,3}$/.test(quantity.trim()) &&
  Number(quantity) >= 1 &&
  Number(quantity) <= MAX_COMBO_QUANTITY

export const parseCombo = (rows: readonly ComboRow[]): ComboComponent[] =>
  rows.map((row) => ({ variant_id: row.variantId, quantity: Number(row.quantity) || 1 }))

// A row for a picked variant, or the rows unchanged when it is already there.
export const withComboRow = (
  rows: readonly ComboRow[],
  hit: { variantId: string; name: string },
) =>
  rows.some((row) => row.variantId === hit.variantId)
    ? [...rows]
    : [...rows, { variantId: hit.variantId, name: hit.name, quantity: '1' }]

export const sameCombo = (
  stored: readonly { variant_id: string; quantity: number }[],
  next: readonly ComboComponent[],
) =>
  stored.length === next.length &&
  stored.every(
    (row, index) =>
      row.variant_id === next[index].variant_id && row.quantity === next[index].quantity,
  )

// ---------------------------------------------------------------------------
// Saving

export type OperationsValue = {
  operations: ProductOperations
  comboComponents: ComboComponent[]
  modifierGroupIds: string[]
}
export type OperationWrite = {
  step: 'operations' | 'combo' | 'addons'
  path: string
  body: unknown
}

// The writes that bring a prepared product's stored data (null: nothing
// stored yet) to `next`. A combo lists its contents instead of add-on groups,
// so its groups are cleared; a clearing write goes before the one that sets
// the other side, so the product is never a combo with groups.
export function operationWrites(
  productId: string,
  current: ProductPosConfig | null,
  next: OperationsValue,
): OperationWrite[] {
  const base = `/pos/products/${productId}`
  const writes: OperationWrite[] = []
  if (!sameOperations(operationsOf(current), next.operations))
    writes.push({ step: 'operations', path: `${base}/settings`, body: next.operations })
  const combo = next.comboComponents
  const groups = combo.length > 0 ? [] : next.modifierGroupIds
  const comboWrite: OperationWrite | null = sameCombo(current?.components ?? [], combo)
    ? null
    : { step: 'combo', path: `${base}/combo`, body: { components: combo } }
  const groupsWrite: OperationWrite | null = sameIds(current?.modifier_group_ids ?? [], groups)
    ? null
    : { step: 'addons', path: `${base}/modifier_groups`, body: { modifier_group_ids: groups } }
  const ordered = combo.length > 0 ? [groupsWrite, comboWrite] : [comboWrite, groupsWrite]
  for (const write of ordered) if (write) writes.push(write)
  return writes
}

// What "copy from another product" puts into the form: the source's kitchen
// settings, add-on groups and combo contents.
export const copiedOperations = (source: ProductPosConfig) => ({
  operations: operationsForm(operationsOf(source)),
  modifierGroupIds: [...source.modifier_group_ids],
  comboComponents: comboRows(source.components),
})
