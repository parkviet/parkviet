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
import { posRequest } from '../lib/pos-request'
import { goodsKey, type ProductListParams } from './use-goods'
import type { ProductTypeIds } from './use-goods-setup'
import { POS_CHANNEL_CODE } from './use-goods-setup'
import { useSession } from './use-session'

// Reads and the save sequence of the goods product screens. Products stay
// Spree records; the POS tables touched beside them are the branch
// assortment (`branch_products`) and the store-wide selling unit
// (`variant_units`), both through their existing POS endpoints.

// Everything a list row or the form reads of a product.
export const PRODUCT_EXPAND = ['variants', 'variants.stock_levels', 'default_variant']
export const PRODUCT_FORM_EXPAND = [...PRODUCT_EXPAND, 'categories', 'media', 'channels']

export type VariantUnitRow = { variant_id: string; sale_unit: string; sale_unit_name: string }
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
export function useProductUnit(variantId: string | null) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'variant-unit', variantId),
    enabled: status === 'authenticated' && Boolean(variantId),
    queryFn: async () => (await readVariantUnits([variantId ?? '']))[0] ?? null,
  })
}

// The next free generated SKU. Variants are read highest first; a candidate
// another product took meanwhile is skipped.
export async function generateSku(client: Pick<typeof adminClient, 'variants'> = adminClient) {
  const { data } = await client.variants.list({ sku_start: SKU_PREFIX, sort: '-sku', limit: 100 })
  const taken = data.map((variant) => variant.sku)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = nextSku(taken)
    const clash = await client.variants.list({ sku_eq: candidate, limit: 1 })
    if (clash.data.length === 0) return candidate
    taken.push(candidate)
  }
  return nextSku(taken)
}

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
  step: 'branches' | 'unit' | 'image' | 'channel'
  error: unknown
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
}

async function attempt(
  failures: FollowUpFailure[],
  step: FollowUpFailure['step'],
  run: () => Promise<unknown>,
) {
  try {
    await run()
    return true
  } catch (error) {
    failures.push({ step, error })
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
  const sku = value.sku || (await generateSku())
  const parsed = { ...value, sku }
  const failures: FollowUpFailure[] = []
  const existing = context.existing
  let product: Product
  if (existing) {
    product = await adminClient.products.update(
      existing.product.id,
      productUpdateBody(parsed, existing.product, { currency: context.currency, productTypeId }),
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
    if (unitChanged && through && optionVariants(product).length === 0 && published)
      await attempt(failures, 'unit', () =>
        setUnit(through, product.default_variant_id, parsed.unitCode),
      )
  }
  return { productId: product.id, failures }
}

export const onPosChannel = (product: Pick<Product, 'channels'>) =>
  (product.channels ?? []).some((channel) => channel.code === POS_CHANNEL_CODE)
