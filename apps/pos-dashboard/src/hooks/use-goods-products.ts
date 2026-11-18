import type { Product } from '@spree/admin-sdk'
import { adminClient } from '@spree/dashboard-core'
import { useQuery } from '@tanstack/react-query'
import {
  branchChanges,
  nextSku,
  optionVariants,
  type ParsedGoodsProduct,
  productCreateBody,
  productUpdateBody,
  SKU_PREFIX,
} from '../lib/goods-products'
import {
  type OptionNames,
  type ParsedVariantRow,
  planOptionTypes,
  variantChanges,
} from '../lib/goods-variants'
import { posRequest } from '../lib/pos-request'
import { goodsKey, type ProductListParams } from './use-goods'
import type { ProductTypeIds } from './use-goods-setup'
import { listAll, POS_CHANNEL_CODE } from './use-goods-setup'
import { useSession } from './use-session'

// Reads and the save sequence of the goods product screens. Products stay
// Spree records; the POS tables touched beside them are the branch
// assortment (`branch_products`) and the store-wide selling unit
// (`variant_units`), both through their existing POS endpoints.

// Everything a list row or the form reads of a product.
export const PRODUCT_EXPAND = ['variants', 'variants.stock_levels', 'default_variant']
export const PRODUCT_FORM_EXPAND = [...PRODUCT_EXPAND, 'categories', 'media', 'channels']

export type VariantUnitRow = {
  variant_id: string
  sale_unit: string
  sale_unit_name: string
  base_unit?: string
  ratio_numerator?: number
  ratio_denominator?: number
}
export type GoodsListProduct = Product & { unit_name: string | null }

export const readVariantUnits = async (variantIds: string[]) =>
  variantIds.length === 0
    ? []
    : (
        await posRequest<{ data: VariantUnitRow[] }>('GET', '/pos/units/variants', {
          params: { variant_ids: variantIds.join(',') },
        })
      ).data

// One page of products with each row's selling unit. The unit read is a
// convenience: when it is refused the list still shows, without units.
export async function readGoodsProducts(params: ProductListParams) {
  const page = await adminClient.products.list(params)
  const units = await readVariantUnits(page.data.map((row) => row.default_variant_id)).catch(
    () => [] as VariantUnitRow[],
  )
  const unitOf = new Map(units.map((unit) => [unit.variant_id, unit.sale_unit_name]))
  return {
    ...page,
    data: page.data.map(
      (row): GoodsListProduct => ({
        ...row,
        unit_name: unitOf.get(row.default_variant_id) ?? null,
      }),
    ),
  }
}

// Every page matching the list's current request, for the CSV export.
export async function readAllGoodsProducts(params: ProductListParams) {
  const rows: GoodsListProduct[] = []
  for (let page: number | null = 1; page !== null; ) {
    const result = await readGoodsProducts({ ...params, page, limit: 100 })
    rows.push(...result.data)
    page = result.meta.next
  }
  return rows
}

export type StoreUnitOption = {
  id: string
  code: string
  name: string
  dimension: string
  base_code: string
  status: string
}
// Units a product can be sold in: the store's canonical active units (a
// conversion to another unit is set up on the variant's unit editor).
export function useGoodsUnits(enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'units'),
    enabled: enabled && status === 'authenticated',
    queryFn: async () =>
      (await posRequest<{ data: StoreUnitOption[] }>('GET', '/pos/units')).data.filter(
        (unit) => unit.status === 'active' && unit.code === unit.base_code,
      ),
  })
}
export const createUnit = (body: { code: string; name: string; dimension: string }) =>
  posRequest<{ data: StoreUnitOption }>('POST', '/pos/units', {
    body: { ...body, base_code: body.code, factor_to_base: 1, sale_precision: 0 },
  })

// Tax rates by tax category, for showing a category's rate. Reading rates
// needs settings access; without it the categories show without rates.
export function useGoodsTaxRates(enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'tax-rates'),
    enabled: enabled && status === 'authenticated',
    retry: false,
    queryFn: async () => (await adminClient.taxRates.list({ limit: 100 })).data,
  })
}

// Branches (of those given) that sell the product now.
export async function readProductBranches(productId: string, branchIds: readonly string[]) {
  const answers = await Promise.all(
    branchIds.map(async (branchId) => {
      const { data } = await posRequest<{ data: { id: string; assigned: boolean }[] }>(
        'GET',
        `/pos/branches/${branchId}/products`,
        { params: { product_id: productId } },
      )
      return data.some((row) => row.id === productId && row.assigned) ? branchId : null
    }),
  )
  return answers.filter((id): id is string => id !== null)
}
export function useProductBranches(productId: string, branchIds: string[], enabled: boolean) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'product-branches', productId, branchIds),
    enabled: enabled && status === 'authenticated' && productId !== '',
    queryFn: () => readProductBranches(productId, branchIds),
  })
}
// The selling unit and conversion of each of a product's variants.
export function useVariantUnits(variantIds: string[], enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'variant-units', variantIds),
    enabled: enabled && status === 'authenticated' && variantIds.length > 0,
    queryFn: () => readVariantUnits(variantIds),
  })
}
// The store's option types with their values, offered as attribute names.
export function useGoodsOptionTypes(enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'option-types'),
    enabled: enabled && status === 'authenticated',
    queryFn: () =>
      listAll((page) =>
        adminClient.optionTypes.list({ limit: 100, page, expand: ['option_values'] }),
      ),
  })
}
export function useProductUnit(variantId: string | null) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'variant-unit', variantId),
    enabled: status === 'authenticated' && Boolean(variantId),
    queryFn: async () => (await readVariantUnits([variantId ?? '']))[0] ?? null,
  })
}

// The next free generated SKUs, one per variant to name. Variants are read
// highest first; a candidate another product took meanwhile is skipped, and
// `reserved` (SKUs typed in the same form) are never handed out.
export async function generateSkus(
  count: number,
  client: Pick<typeof adminClient, 'variants'> = adminClient,
  reserved: readonly string[] = [],
) {
  if (count === 0) return []
  const { data } = await client.variants.list({ sku_start: SKU_PREFIX, sort: '-sku', limit: 100 })
  const taken: (string | null)[] = [...data.map((variant) => variant.sku), ...reserved]
  const picked: string[] = []
  while (picked.length < count) {
    let candidate = nextSku(taken)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await client.variants.list({ sku_eq: candidate, limit: 1 })
      if (clash.data.length === 0) break
      taken.push(candidate)
      candidate = nextSku(taken)
    }
    taken.push(candidate)
    picked.push(candidate)
  }
  return picked
}
export const generateSku = async (client: Pick<typeof adminClient, 'variants'> = adminClient) =>
  (await generateSkus(1, client))[0]

// Makes every attribute and value an option type of the store, so variants
// name them by their stored names.
export async function ensureOptionTypes(
  attributes: ParsedGoodsProduct['attributes'],
  client: Pick<typeof adminClient, 'optionTypes'> = adminClient,
): Promise<OptionNames> {
  if (attributes.length === 0) return []
  const existing = await listAll((page) =>
    client.optionTypes.list({ limit: 100, page, expand: ['option_values'] }),
  )
  const { writes, names } = planOptionTypes(attributes, existing)
  for (const write of writes)
    if (write.kind === 'create') await client.optionTypes.create(write.params)
    else await client.optionTypes.update(write.id, write.params)
  return names
}

// Gives rows without a SKU generated ones.
async function namedRows(rows: ParsedVariantRow[]) {
  const typed = rows.map((row) => row.sku).filter(Boolean)
  const generated = await generateSkus(rows.filter((row) => !row.sku).length, adminClient, typed)
  return rows.map((row) => (row.sku ? row : { ...row, sku: generated.shift() ?? '' }))
}

// The add-on groups of a product live on its menu item: one is created for
// the product the first time groups are chosen, then its groups are replaced.
export type ProductMenuItem = { id: string; kind: string; modifierGroupIds: string[] }
export async function saveProductAddons(
  productId: string,
  menuItem: ProductMenuItem | null,
  groupIds: readonly string[],
) {
  const body = { modifier_group_ids: groupIds }
  const idempotencyKey = crypto.randomUUID()
  if (menuItem)
    return posRequest('PATCH', `/pos/menu_items/${menuItem.id}`, { body, idempotencyKey })
  if (groupIds.length === 0) return null
  return posRequest('POST', '/pos/menu_items', {
    body: { product_id: productId, kind: 'single', ...body },
    idempotencyKey,
  })
}
export const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

const assign = (branchId: string, productId: string) =>
  posRequest('POST', `/pos/branches/${branchId}/products`, { body: { product_id: productId } })
const unassign = (branchId: string, productId: string) =>
  posRequest('DELETE', `/pos/branches/${branchId}/products/${productId}`)
const setUnit = (branchId: string, variantId: string, unit: string) =>
  posRequest('PUT', '/pos/units/variant', {
    body: {
      branch_id: branchId,
      variant_id: variantId,
      sale_unit: unit,
      base_unit: unit,
      price_unit: unit,
      ratio_numerator: 1,
      ratio_denominator: 1,
      tracked_mode: 'none',
    },
  })

// A step after the product itself was saved that did not go through. The
// product is kept; saving again repeats only what is still missing.
export type FollowUpFailure = {
  step: 'branches' | 'unit' | 'image' | 'channel' | 'addons' | 'variantCreate' | 'variantDelete'
  error: unknown
  // The variant a variant step was about.
  label?: string
}
export type SaveOutcome = { productId: string; failures: FollowUpFailure[] }

export type SaveContext = {
  currency: string
  ensurePosChannel: () => Promise<{ id: string }>
  ensureProductTypes: () => Promise<ProductTypeIds>
  stockLocations: Record<string, string>
  // Whether the signed-in staff may change branch assortments.
  manageBranches: boolean
  image: File | null
  // What is stored now; absent when the product is new.
  existing?: {
    product: Product
    branchIds: string[]
    unitCode: string
  }
  // The product's menu item when add-on groups are managed here (null: none
  // yet); absent when the signed-in staff cannot change the menu.
  addons?: { menuItem: ProductMenuItem | null }
}

async function attempt(
  failures: FollowUpFailure[],
  step: FollowUpFailure['step'],
  run: () => Promise<unknown>,
  label?: string,
) {
  try {
    await run()
    return true
  } catch (error) {
    failures.push({ step, error, ...(label ? { label } : {}) })
    return false
  }
}

// Saves the product, then the POS records beside it. A refusal of the
// product itself (409, 422) is thrown untouched so the form can map it; a
// later step's refusal is reported in `failures` instead.
export async function saveGoodsProduct(
  value: ParsedGoodsProduct,
  context: SaveContext,
): Promise<SaveOutcome> {
  const types = await context.ensureProductTypes()
  const productTypeId = types[value.kind]
  const withOptions = value.attributes.length > 0
  const sku = withOptions ? value.sku : value.sku || (await generateSku())
  const parsed = { ...value, sku, variants: await namedRows(value.variants) }
  const optionNames = await ensureOptionTypes(parsed.attributes)
  const failures: FollowUpFailure[] = []
  const existing = context.existing
  let product: Product
  if (existing) {
    const changes = withOptions
      ? variantChanges(parsed.variants, existing.product, {
          currency: context.currency,
          trackInventory: parsed.trackInventory,
          stockLocations: context.stockLocations,
          branchIds: parsed.branchIds,
          names: optionNames,
        })
      : null
    product = await adminClient.products.update(
      existing.product.id,
      productUpdateBody(parsed, existing.product, {
        currency: context.currency,
        productTypeId,
        variants: changes?.updates,
      }),
    )
    // Removed first, so a SKU freed by a removed variant can be taken by a new one.
    for (const removed of changes?.deletes ?? [])
      await attempt(
        failures,
        'variantDelete',
        () => adminClient.products.variants.delete(existing.product.id, removed.id),
        removed.label,
      )
    for (const added of changes?.creates ?? [])
      await attempt(
        failures,
        'variantCreate',
        () => adminClient.products.variants.create(existing.product.id, added.params),
        added.label,
      )
    if (context.image) {
      const image = context.image
      await attempt(failures, 'image', async () => {
        const { signed_id } = await adminClient.files.upload(image)
        await adminClient.products.media.create(existing.product.id, { signed_id, position: 1 })
        for (const old of existing.product.media ?? [])
          await adminClient.products.media.delete(existing.product.id, old.id)
      })
    }
  } else {
    const channel = await context.ensurePosChannel()
    const imageSignedId = context.image
      ? (await adminClient.files.upload(context.image)).signed_id
      : null
    product = await adminClient.products.create(
      productCreateBody(parsed, {
        currency: context.currency,
        channelId: channel.id,
        productTypeId,
        stockLocations: context.stockLocations,
        imageSignedId,
        optionNames,
      }),
    )
  }

  if (context.manageBranches) {
    const current = existing?.branchIds ?? []
    const { add, remove } = branchChanges(current, parsed.branchIds)
    let published = true
    // A product from the store's catalog not yet on the `pos` channel is put
    // on it before a branch can sell it; other channels are left as they are.
    if (existing && add.length > 0 && !onPosChannel(existing.product))
      published = await attempt(failures, 'channel', async () => {
        const channel = await context.ensurePosChannel()
        await adminClient.products.bulkAddToChannels({
          ids: [product.id],
          channel_ids: [channel.id],
        })
      })
    if (published)
      await attempt(failures, 'branches', async () => {
        for (const branchId of add) await assign(branchId, product.id)
        for (const branchId of remove) await unassign(branchId, product.id)
      })
    // The unit is store-wide but set through a branch that sells the product.
    const through = parsed.branchIds[0]
    const unitChanged = parsed.unitCode !== (existing?.unitCode ?? 'item')
    const simple = !withOptions && optionVariants(product).length === 0
    if (unitChanged && through && simple && published)
      await attempt(failures, 'unit', () =>
        setUnit(through, product.default_variant_id, parsed.unitCode),
      )
  }
  // After the branches: a new menu item also joins the assortment of every
  // branch running the menu.
  const addons = context.addons
  if (addons && !sameIds(addons.menuItem?.modifierGroupIds ?? [], parsed.modifierGroupIds))
    await attempt(failures, 'addons', () =>
      saveProductAddons(product.id, addons.menuItem, parsed.modifierGroupIds),
    )
  return { productId: product.id, failures }
}

export const onPosChannel = (product: Pick<Product, 'channels'>) =>
  (product.channels ?? []).some((channel) => channel.code === POS_CHANNEL_CODE)
