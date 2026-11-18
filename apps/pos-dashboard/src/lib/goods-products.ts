import { formatMoney } from '@parkviet/pos-shared/money'
import type {
  PriceParams,
  ProductCreateParams,
  ProductUpdateParams,
  ProductVariantParams,
} from '@spree/admin-sdk'
import {
  type AttributeValues,
  attributesFromVariants,
  createdVariants,
  type OptionNames,
  type OptionVariantSlice,
  type ParsedVariantRow,
  type VariantRowValues,
} from './goods-variants'

// Pure mapping between Spree products and what the goods screens show and
// send. Inputs are structural slices of the Admin API records, so tests and
// callers never need a whole SDK entity, and form values stay plain strings.

type PriceSlice = { amount: string | null; currency?: string | null } | null | undefined
type StockLevelSlice = { stock_location_id: string | null; count_on_hand: number }
export type VariantSlice = {
  id: string
  sku: string | null
  barcode: string | null
  cost_price: string | null
  track_inventory: boolean
  options_text?: string | null
  price?: PriceSlice
  stock_levels?: StockLevelSlice[]
  option_values?: OptionVariantSlice['option_values']
}
export type ProductSlice = {
  id: string
  name: string
  status: string
  in_stock: boolean
  default_variant_id: string
  price: PriceSlice
  product_type_id: string | null
  tax_category_id: string | null
  total_on_hand: number | null
  variants?: VariantSlice[]
  default_variant?: VariantSlice
}

// Variants a product is sold through when it has options. A simple product
// lists only its default variant, which carries no option text.
export const optionVariants = (product: Pick<ProductSlice, 'variants'>) =>
  (product.variants ?? []).filter((variant) => Boolean(variant.options_text?.trim()))

// What a row shows for the single variant of a simple product, or every
// option variant otherwise.
export function sellingVariants(product: ProductSlice): VariantSlice[] {
  const options = optionVariants(product)
  if (options.length > 0) return options
  const main =
    product.default_variant ??
    product.variants?.find((variant) => variant.id === product.default_variant_id) ??
    product.variants?.[0]
  return main ? [main] : []
}

const decimal = (value: string | null | undefined) =>
  value != null && /^-?\d+(?:\.\d+)?$/.test(value) ? value : null
// Order of two canonical decimal strings; amounts are displayed from the
// strings themselves, the number is only compared.
const byAmount = (a: string, b: string) => Number(a) - Number(b)
export function amountRange(values: (string | null | undefined)[]) {
  const amounts = values.map(decimal).filter((value): value is string => value !== null)
  if (amounts.length === 0) return null
  const sorted = [...amounts].sort(byAmount)
  return { min: sorted[0], max: sorted[sorted.length - 1] }
}
export function formatRange(range: { min: string; max: string } | null, currency: string) {
  if (!range) return '—'
  if (byAmount(range.min, range.max) === 0) return formatMoney(range.min, currency)
  return `${formatMoney(range.min, currency)} – ${formatMoney(range.max, currency)}`
}
export function priceRange(product: ProductSlice) {
  const variants = optionVariants(product)
  if (variants.length === 0) return amountRange([product.price?.amount])
  return amountRange(variants.map((variant) => variant.price?.amount))
}
export const costRange = (product: ProductSlice) =>
  amountRange(sellingVariants(product).map((variant) => variant.cost_price))

// Stock across the branches' selling locations. A product whose variants are
// not tracked is shown as available or sold out instead of a count.
export type ProductStock = { tracked: true; onHand: number } | { tracked: false; inStock: boolean }
export function productStock(
  product: ProductSlice,
  locationIds: readonly string[] | null,
): ProductStock {
  const variants = sellingVariants(product)
  if (variants.length > 0 && variants.every((variant) => !variant.track_inventory))
    return { tracked: false, inStock: product.in_stock }
  if (!locationIds) return { tracked: true, onHand: product.total_on_hand ?? 0 }
  const locations = new Set(locationIds)
  const onHand = variants
    .filter((variant) => variant.track_inventory)
    .flatMap((variant) => variant.stock_levels ?? [])
    .filter((level) => level.stock_location_id !== null && locations.has(level.stock_location_id))
    .reduce((sum, level) => sum + level.count_on_hand, 0)
  return { tracked: true, onHand }
}

const joined = (values: (string | null | undefined)[]) => {
  const present = [...new Set(values.map((value) => value?.trim()).filter(Boolean))]
  return present.length ? present.join(', ') : '—'
}

// Every list column as plain text, for both the CSV export and the cells
// that need nothing more than text.
export const GOODS_COLUMNS = [
  'name',
  'sku',
  'barcode',
  'unit',
  'cost_price',
  'price',
  'tax',
  'status',
  'stock',
  'product_type',
] as const
export type GoodsColumn = (typeof GOODS_COLUMNS)[number]
export type GoodsCellContext = {
  currency: string
  locationIds: readonly string[] | null
  unitName: (variantId: string) => string | null
  taxLabel: (taxCategoryId: string | null) => string
  typeName: (productTypeId: string | null) => string
  statusLabel: (status: string) => string
  stockLabel: (stock: ProductStock) => string
}
export function goodsCells(
  product: ProductSlice,
  context: GoodsCellContext,
): Record<GoodsColumn, string> {
  const variants = sellingVariants(product)
  return {
    name: product.name,
    sku: joined(variants.map((variant) => variant.sku)),
    barcode: joined(variants.map((variant) => variant.barcode)),
    unit: context.unitName(product.default_variant_id) ?? '—',
    cost_price: formatRange(costRange(product), context.currency),
    price: formatRange(priceRange(product), context.currency),
    tax: context.taxLabel(product.tax_category_id),
    status: context.statusLabel(product.status),
    stock: context.stockLabel(productStock(product, context.locationIds)),
    product_type: context.typeName(product.product_type_id),
  }
}

// RFC 4180 text with a BOM, so spreadsheet apps read Vietnamese as UTF-8.
const CSV_FORMULA = /^[=+\-@\t\r]/
function csvField(value: string) {
  // A leading formula character would run as a formula when opened.
  const safe = CSV_FORMULA.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
export const toCsv = (rows: readonly (readonly string[])[]) =>
  `﻿${rows.map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`

// Hands the text to the browser as a CSV file download.
export function downloadCsv(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Generated SKUs are a prefix (`SP` for products, `NL` for ingredients) and
// six digits, one above the highest in use with that prefix.
export const SKU_PREFIX = 'SP'
export function nextSku(existing: readonly (string | null | undefined)[], prefix = SKU_PREFIX) {
  const generated = new RegExp(`^${prefix}(\\d{6,})$`)
  const highest = existing.reduce((max, sku) => {
    const match = sku ? generated.exec(sku.trim()) : null
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(6, '0')}`
}

// Product images the form accepts.
export const IMAGE_TYPES = ['image/png', 'image/jpeg'] as const
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024
export function imageProblem(file: { type: string; size: number }) {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'type' as const
  if (file.size > IMAGE_MAX_BYTES) return 'size' as const
  return null
}

export const PREP_PRESETS = [3, 5, 10, 15, 20, 30] as const

// ---------------------------------------------------------------------------
// Form

export type GoodsKind = 'goods' | 'service'
export type GoodsProductFormValues = {
  name: string
  kind: GoodsKind
  unitCode: string
  sku: string
  barcode: string
  description: string
  prepMinutes: string
  price: string
  costPrice: string
  taxCategoryId: string
  trackInventory: boolean
  // Opening count per branch id, typed as text.
  openingStock: Record<string, string>
  categoryIds: string[]
  branchIds: string[]
  // Attributes and the variant matrix; no attribute is a simple product.
  attributes: AttributeValues[]
  variants: VariantRowValues[]
  // Add-on groups offered with the product (its menu item's groups).
  modifierGroupIds: string[]
}
// Already validated and canonical (see `schemas/goods-product.ts`).
export type ParsedGoodsProduct = Omit<
  GoodsProductFormValues,
  'prepMinutes' | 'price' | 'costPrice' | 'openingStock' | 'variants'
> & {
  prepMinutes: number | null
  price: string
  costPrice: string | null
  openingStock: Record<string, number>
  // The combinations kept in the product, in matrix order.
  variants: ParsedVariantRow[]
}

export const emptyGoodsProduct = (branchIds: string[]): GoodsProductFormValues => ({
  name: '',
  kind: 'goods',
  unitCode: 'item',
  sku: '',
  barcode: '',
  description: '',
  prepMinutes: '',
  price: '',
  costPrice: '',
  taxCategoryId: '',
  trackInventory: true,
  openingStock: {},
  categoryIds: [],
  branchIds,
  attributes: [],
  variants: [],
  modifierGroupIds: [],
})

type EditableProduct = ProductSlice & {
  description: string | null
  metadata: Record<string, unknown>
  categories?: { id: string }[]
}
// Product metadata key holding the preparation time in whole minutes.
export const PREP_MINUTES_KEY = 'prep_minutes'
export function prepMinutesOf(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.[PREP_MINUTES_KEY]
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}
export function formFromProduct(
  product: EditableProduct,
  context: { kind: GoodsKind; unitCode: string; branchIds: string[]; modifierGroupIds?: string[] },
): GoodsProductFormValues {
  const variant = sellingVariants(product)[0]
  const prep = prepMinutesOf(product.metadata)
  // Variants whose attributes cannot be read back keep their values as they are.
  const matrix = attributesFromVariants(optionVariants(product))
  return {
    name: product.name,
    kind: context.kind,
    unitCode: context.unitCode,
    sku: variant?.sku ?? '',
    barcode: variant?.barcode ?? '',
    description: product.description ?? '',
    prepMinutes: prep === null ? '' : String(prep),
    price: decimal(product.price?.amount) ?? '',
    costPrice: decimal(variant?.cost_price) ?? '',
    taxCategoryId: product.tax_category_id ?? '',
    trackInventory: variant?.track_inventory ?? true,
    openingStock: {},
    categoryIds: (product.categories ?? []).map((category) => category.id),
    branchIds: context.branchIds,
    attributes: matrix.attributes,
    variants: matrix.rows,
    modifierGroupIds: context.modifierGroupIds ?? [],
  }
}
// Whether the form can edit a product's variants: a product whose stored
// variants do not each name one value of every attribute cannot.
export const variantsEditable = (product: Pick<ProductSlice, 'variants'>) =>
  attributesFromVariants(optionVariants(product)).derivable

const withPrep = (metadata: Record<string, unknown>, minutes: number | null) => {
  const { [PREP_MINUTES_KEY]: _previous, ...rest } = metadata
  return minutes === null ? rest : { ...rest, [PREP_MINUTES_KEY]: minutes }
}
const variantFields = (value: ParsedGoodsProduct, currency: string): ProductVariantParams => ({
  sku: value.sku,
  barcode: value.barcode,
  cost_price: value.costPrice,
  ...(value.costPrice === null ? {} : { cost_currency: currency as PriceParams['currency'] }),
  track_inventory: value.trackInventory,
})

export type CreateContext = {
  currency: string
  channelId: string
  productTypeId: string
  // Selling stock location of each branch, by branch id.
  stockLocations: Record<string, string>
  imageSignedId?: string | null
  // Option type names of the attributes (from `planOptionTypes`).
  optionNames?: OptionNames
}
// A new product goes on sale at once on the `pos` channel. Opening stock is
// written only for tracked items, at the selected branches' locations.
export function productCreateBody(
  value: ParsedGoodsProduct,
  context: CreateContext,
): ProductCreateParams {
  const levels = value.trackInventory
    ? value.branchIds.flatMap((branchId) => {
        const location = context.stockLocations[branchId]
        return location
          ? [{ stock_location_id: location, count_on_hand: value.openingStock[branchId] ?? 0 }]
          : []
      })
    : []
  const withOptions = value.attributes.length > 0
  return {
    name: value.name,
    status: 'active',
    product_type_id: context.productTypeId,
    ...(value.description ? { description: value.description } : {}),
    ...(value.taxCategoryId ? { tax_category_id: value.taxCategoryId } : {}),
    category_ids: value.categoryIds,
    metadata: withPrep({}, value.prepMinutes),
    // A product with options is priced per variant, never both ways.
    ...(withOptions
      ? {}
      : {
          prices: [{ currency: context.currency as PriceParams['currency'], amount: value.price }],
        }),
    product_publications: [{ channel_id: context.channelId }],
    ...(context.imageSignedId ? { media: [{ signed_id: context.imageSignedId }] } : {}),
    variants: withOptions
      ? createdVariants(value.variants, {
          currency: context.currency,
          trackInventory: value.trackInventory,
          stockLocations: context.stockLocations,
          branchIds: value.branchIds,
          names: context.optionNames ?? [],
        })
      : [
          {
            ...variantFields(value, context.currency),
            ...(levels.length > 0 ? { stock_levels: levels } : {}),
          },
        ],
  }
}

// An edit never sends stock levels: the API removes locations left out of
// them, and stock already counted keeps its history through the inventory
// screens. With attributes, the stored variants kept in the matrix ride
// along (`variants`, from `variantChanges`); a product whose variants the
// form cannot edit keeps its per-variant price and codes.
export function productUpdateBody(
  value: ParsedGoodsProduct,
  product: Pick<EditableProduct, 'default_variant_id' | 'metadata' | 'variants'>,
  context: { currency: string; productTypeId: string; variants?: ProductVariantParams[] },
): ProductUpdateParams {
  const withOptions = value.attributes.length > 0
  const simple = !withOptions && optionVariants(product).length === 0
  return {
    name: value.name,
    product_type_id: context.productTypeId,
    description: value.description,
    ...(value.taxCategoryId ? { tax_category_id: value.taxCategoryId } : {}),
    category_ids: value.categoryIds,
    metadata: withPrep(product.metadata ?? {}, value.prepMinutes),
    ...(simple
      ? {
          prices: [{ currency: context.currency as PriceParams['currency'], amount: value.price }],
          variants: [{ id: product.default_variant_id, ...variantFields(value, context.currency) }],
        }
      : {}),
    ...(withOptions && context.variants?.length ? { variants: context.variants } : {}),
  }
}

// What a bulk delete did: the server skips products it refuses (on orders,
// an ingredient of an active recipe) and counts only those it deleted.
export function bulkDeleteOutcome(selected: number, deleted: number) {
  const count = Math.min(Math.max(0, deleted), selected)
  return { count, refused: selected - count }
}

// Branch assignments to add and remove so the product ends up sold exactly
// at the selected branches.
export function branchChanges(current: readonly string[], selected: readonly string[]) {
  const now = new Set(current)
  const wanted = new Set(selected)
  return {
    add: selected.filter((id) => !now.has(id)),
    remove: current.filter((id) => !wanted.has(id)),
  }
}
