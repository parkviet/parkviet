import type {
  OptionTypeCreateParams,
  OptionTypeUpdateParams,
  PriceParams,
  ProductVariantParams,
  VariantCreateParams,
  VariantOptionParams,
} from '@spree/admin-sdk'

// Attributes (Spree option types) and the variant matrix they make. Form
// values stay plain strings; option types and values are named by stable
// ASCII slugs and shown by the label the staff typed.

export const MAX_ATTRIBUTES = 3
export const MAX_ATTRIBUTE_VALUES = 30
export const MAX_VARIANTS = 100

export type AttributeValues = { name: string; values: string[] }
// One cell of the matrix: a combination of one value per attribute.
export type VariantRowValues = {
  key: string
  // The value labels, in attribute order.
  values: string[]
  // The stored variant this row edits; null for a combination still to create.
  variantId: string | null
  // A combination left out of the product (deleted on save when stored).
  enabled: boolean
  sku: string
  barcode: string
  price: string
  costPrice: string
  // Opening count per branch id, for a variant still to create.
  openingStock: Record<string, string>
}
// Already validated and canonical (see `schemas/goods-product.ts`).
export type ParsedVariantRow = {
  key: string
  values: string[]
  variantId: string | null
  sku: string
  barcode: string
  price: string
  costPrice: string | null
  openingStock: Record<string, number>
}

// Compares labels as staff read them: case, spacing and Unicode form aside.
export const sameText = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi')
// An ASCII name for an option type or value: marks dropped, `đ` as `d`.
export const optionSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

export const comboKey = (values: readonly string[]) => JSON.stringify(values.map(sameText))
export const rowLabel = (row: Pick<VariantRowValues, 'values'>) => row.values.join(' / ')

// Every combination of one value per attribute, in attribute order. No
// attribute (or one without values) makes no combination.
export function combinations(attributes: readonly AttributeValues[]): string[][] {
  if (attributes.length === 0) return []
  return attributes.reduce<string[][]>(
    (rows, attribute) => rows.flatMap((row) => attribute.values.map((value) => [...row, value])),
    [[]],
  )
}
export const combinationCount = (attributes: readonly AttributeValues[]) =>
  attributes.length === 0 ? 0 : attributes.reduce((count, item) => count * item.values.length, 1)

// The matrix after an attribute change. A combination keeps the row it had
// (or the stored one it had when the form opened, so removing and adding a
// value back edits the same variant); a new one starts from `defaults`.
export function syncVariantRows(
  attributes: readonly AttributeValues[],
  current: readonly VariantRowValues[],
  initial: readonly VariantRowValues[],
  defaults: { price: string; costPrice: string },
): VariantRowValues[] {
  if (combinationCount(attributes) > MAX_VARIANTS) return [...current]
  const byKey = new Map(initial.map((row) => [row.key, row]))
  for (const row of current) byKey.set(row.key, row)
  return combinations(attributes).map((values) => {
    const key = comboKey(values)
    const known = byKey.get(key)
    if (known) return { ...known, values }
    return {
      key,
      values,
      variantId: null,
      enabled: true,
      sku: '',
      barcode: '',
      price: defaults.price,
      costPrice: defaults.costPrice,
      openingStock: {},
    }
  })
}

// ---------------------------------------------------------------------------
// Stored variants

type OptionValueSlice = {
  id: string
  option_type_id: string
  option_type_label: string
  name: string
  label: string
  position: number
}
export type OptionVariantSlice = {
  id: string
  sku: string | null
  barcode: string | null
  cost_price: string | null
  options_text?: string | null
  price?: { amount: string | null } | null
  option_values?: OptionValueSlice[]
}

const decimal = (value: string | null | undefined) =>
  value != null && /^-?\d+(?:\.\d+)?$/.test(value) ? value : ''

// The attributes and matrix of a product's option variants. `derivable` is
// false when a variant does not name a value of every attribute (an old or
// hand-made catalog row); such a product's variants are kept as they are.
export function attributesFromVariants(variants: readonly OptionVariantSlice[]): {
  attributes: AttributeValues[]
  rows: VariantRowValues[]
  derivable: boolean
} {
  if (variants.length === 0) return { attributes: [], rows: [], derivable: true }
  const first = variants[0].option_values ?? []
  const typeIds = first.map((value) => value.option_type_id)
  const derivable =
    typeIds.length > 0 &&
    new Set(typeIds).size === typeIds.length &&
    variants.every((variant) => {
      const own = (variant.option_values ?? []).map((value) => value.option_type_id)
      return own.length === typeIds.length && typeIds.every((id) => own.includes(id))
    })
  if (!derivable) return { attributes: [], rows: [], derivable: false }
  const attributes = typeIds.map((typeId) => {
    const values = new Map<string, OptionValueSlice>()
    for (const variant of variants)
      for (const value of variant.option_values ?? [])
        if (value.option_type_id === typeId && !values.has(value.id)) values.set(value.id, value)
    const sorted = [...values.values()].sort(
      (a, b) => a.position - b.position || a.label.localeCompare(b.label, 'vi'),
    )
    return {
      name: first.find((value) => value.option_type_id === typeId)?.option_type_label ?? '',
      values: sorted.map((value) => value.label || value.name),
    }
  })
  const rows = variants.map((variant): VariantRowValues => {
    const values = typeIds.map((typeId) => {
      const value = (variant.option_values ?? []).find((item) => item.option_type_id === typeId)
      return value ? value.label || value.name : ''
    })
    return {
      key: comboKey(values),
      values,
      variantId: variant.id,
      enabled: true,
      sku: variant.sku ?? '',
      barcode: variant.barcode ?? '',
      price: decimal(variant.price?.amount),
      costPrice: decimal(variant.cost_price),
      openingStock: {},
    }
  })
  // A combination the product never had starts left out: opening the form
  // creates nothing.
  const matrix = syncVariantRows(attributes, rows, rows, { price: '', costPrice: '' }).map((row) =>
    row.variantId ? row : { ...row, enabled: false },
  )
  return { attributes, rows: matrix, derivable }
}

// ---------------------------------------------------------------------------
// Option types

export type OptionTypeSlice = {
  id: string
  name: string
  label: string
  option_values?: { id: string; name: string; label: string; position: number }[]
}
export type OptionTypeWrite =
  | { kind: 'create'; params: OptionTypeCreateParams }
  | { kind: 'update'; id: string; params: OptionTypeUpdateParams }
// The option type and value names each attribute is sent with.
export type OptionNames = { type: string; values: Map<string, string> }[]

// What to create or extend so every attribute and value exists as a store
// option type, matched by label or by name. Values already there are sent
// back with their ids, as the API replaces the whole set.
export function planOptionTypes(
  attributes: readonly AttributeValues[],
  existing: readonly OptionTypeSlice[],
): { writes: OptionTypeWrite[]; names: OptionNames } {
  const writes: OptionTypeWrite[] = []
  const names: OptionNames = attributes.map((attribute) => {
    const slug = optionSlug(attribute.name)
    const found =
      existing.find((type) => sameText(type.label) === sameText(attribute.name)) ??
      existing.find((type) => type.name === slug)
    const stored = found?.option_values ?? []
    const values = new Map<string, string>()
    const added: { name: string; label: string }[] = []
    for (const label of attribute.values) {
      const valueSlug = optionSlug(label)
      const match =
        stored.find((value) => sameText(value.label) === sameText(label)) ??
        stored.find((value) => value.name === valueSlug)
      if (match) {
        values.set(sameText(label), match.name)
        continue
      }
      const taken = new Set([...stored.map((value) => value.name), ...added.map((v) => v.name)])
      let name = valueSlug
      for (let suffix = 2; taken.has(name); suffix += 1) name = `${valueSlug}-${suffix}`
      added.push({ name, label: label.trim() })
      values.set(sameText(label), name)
    }
    if (!found) {
      writes.push({
        kind: 'create',
        params: {
          name: slug,
          label: attribute.name.trim(),
          option_values: added.map((value, position) => ({ ...value, position: position + 1 })),
        },
      })
      return { type: slug, values }
    }
    if (added.length > 0) {
      const last = stored.reduce((max, value) => Math.max(max, value.position), 0)
      writes.push({
        kind: 'update',
        id: found.id,
        params: {
          option_values: [
            ...stored.map(({ id, name, label, position }) => ({ id, name, label, position })),
            ...added.map((value, index) => ({ ...value, position: last + index + 1 })),
          ],
        },
      })
    }
    return { type: found.name, values }
  })
  return { writes, names }
}

export const variantOptions = (
  names: OptionNames,
  row: Pick<ParsedVariantRow, 'values'>,
): VariantOptionParams[] =>
  names.map((attribute, index) => ({
    name: attribute.type,
    value: attribute.values.get(sameText(row.values[index] ?? '')) ?? optionSlug(row.values[index]),
  }))

// ---------------------------------------------------------------------------
// Payloads

export type VariantWriteContext = {
  currency: string
  trackInventory: boolean
  // Selling stock location of each selected branch, by branch id.
  stockLocations: Record<string, string>
  branchIds: readonly string[]
  names: OptionNames
}

const rowFields = (row: ParsedVariantRow, context: VariantWriteContext) => ({
  sku: row.sku,
  barcode: row.barcode,
  cost_price: row.costPrice,
  ...(row.costPrice === null ? {} : { cost_currency: context.currency as PriceParams['currency'] }),
  track_inventory: context.trackInventory,
  prices: [{ currency: context.currency as PriceParams['currency'], amount: row.price }],
})
// Opening stock of a variant still to create, at the selected branches.
const openingLevels = (row: ParsedVariantRow, context: VariantWriteContext) => {
  if (!context.trackInventory) return []
  return context.branchIds.flatMap((branchId) => {
    const location = context.stockLocations[branchId]
    return location
      ? [{ stock_location_id: location, count_on_hand: row.openingStock[branchId] ?? 0 }]
      : []
  })
}
function newVariant(row: ParsedVariantRow, context: VariantWriteContext): VariantCreateParams {
  const levels = openingLevels(row, context)
  return {
    options: variantOptions(context.names, row),
    ...rowFields(row, context),
    ...(levels.length > 0 ? { stock_levels: levels } : {}),
  }
}

// The variants a new product with attributes is created with.
export const createdVariants = (
  rows: readonly ParsedVariantRow[],
  context: VariantWriteContext,
): ProductVariantParams[] => rows.map((row) => newVariant(row, context))

export type VariantChanges = {
  // Sent with the product update: stored variants kept, by id.
  updates: ProductVariantParams[]
  creates: { label: string; params: VariantCreateParams }[]
  deletes: { id: string; label: string }[]
}
// The `variants` of the product update. That update replaces the product's
// variant set, so a variant to remove rides along unchanged and is deleted on
// its own afterwards: a refused delete (the variant is on orders, or an
// ingredient of an active recipe) is then reported as that step instead of
// failing the whole save. Without kept variants nothing is sent and the
// stored set stays as it is.
export const productUpdateVariants = (changes: VariantChanges): ProductVariantParams[] =>
  changes.updates.length > 0
    ? [...changes.updates, ...changes.deletes.map(({ id }) => ({ id }))]
    : []

// How an edit reaches the wanted matrix. A product without option variants
// turns its single variant into the first combination, so its stock and
// history stay; stored variants not in the matrix are deleted.
export function variantChanges(
  rows: readonly ParsedVariantRow[],
  product: {
    default_variant_id: string
    variants?: readonly { id: string; options_text?: string | null }[]
  },
  context: VariantWriteContext,
): VariantChanges {
  const stored = (product.variants ?? []).filter((variant) => Boolean(variant.options_text?.trim()))
  const storedIds = new Set(stored.map((variant) => variant.id))
  let adopt = stored.length === 0 ? product.default_variant_id : null
  const updates: ProductVariantParams[] = []
  const creates: VariantChanges['creates'] = []
  const kept = new Set<string>()
  for (const row of rows) {
    if (row.variantId && storedIds.has(row.variantId)) {
      kept.add(row.variantId)
      updates.push({ id: row.variantId, ...rowFields(row, context) })
    } else if (adopt) {
      updates.push({
        id: adopt,
        options: variantOptions(context.names, row),
        ...rowFields(row, context),
      })
      adopt = null
    } else creates.push({ label: rowLabel(row), params: newVariant(row, context) })
  }
  const deletes = stored
    .filter((variant) => !kept.has(variant.id))
    .map((variant) => ({ id: variant.id, label: variant.options_text?.trim() ?? variant.id }))
  return { updates, creates, deletes }
}
