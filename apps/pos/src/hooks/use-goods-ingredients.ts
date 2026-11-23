import type { Product } from '@spree/admin-sdk'
import { adminClient } from '@spree/dashboard-core'
import { useQuery } from '@tanstack/react-query'
import {
  INGREDIENT_SKU_PREFIX,
  ingredientCreateBody,
  ingredientUpdateBody,
  type ParsedIngredient,
} from '../lib/goods-ingredients'
import { posRequest } from '../lib/pos-request'
import { goodsKey } from './use-goods'
import { generateSku, readVariantUnits, type VariantUnitRow } from './use-goods-products'
import type { ProductTypeIds } from './use-goods-setup'
import { useSession } from './use-session'

// Reads and the save sequence of the ingredients screen. An ingredient is a
// Spree product of the `Nguyên liệu` type on no channel; beside it the POS
// keeps its stock unit (`variant_units`, set without a branch since no branch
// sells it) and each branch's low-stock threshold (`stock_alerts`).

export const INGREDIENT_EXPAND = ['variants', 'variants.stock_levels']

export type IngredientProduct = Product & { unit: VariantUnitRow | null }

// Every ingredient of the store with its stock unit. The unit read is a
// convenience: when it is refused the list still shows, counted in `item`.
export async function readIngredients(productTypeId: string) {
  const rows: IngredientProduct[] = []
  for (let page: number | null = 1; page !== null; ) {
    const result = await adminClient.products.list({
      product_type_id_eq: productTypeId,
      expand: INGREDIENT_EXPAND,
      sort: 'name',
      limit: 100,
      page,
    })
    const units = await readVariantUnits(result.data.map((row) => row.default_variant_id)).catch(
      () => [] as VariantUnitRow[],
    )
    const unitOf = new Map(units.map((unit) => [unit.variant_id, unit]))
    rows.push(
      ...result.data.map((row) => ({ ...row, unit: unitOf.get(row.default_variant_id) ?? null })),
    )
    page = result.meta.next
  }
  return rows
}
export function useGoodsIngredients(productTypeId: string | null, enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'ingredients', productTypeId),
    enabled: enabled && status === 'authenticated',
    // Before the ingredient type exists the store has no ingredients.
    queryFn: () => (productTypeId ? readIngredients(productTypeId) : Promise.resolve([])),
  })
}

// The stock unit of an ingredient: its canonical unit at 1:1.
export const setStockUnit = (variantId: string, unitCode: string) =>
  posRequest('PUT', '/pos/units/variant', {
    body: { variant_id: variantId, sale_unit: unitCode },
  })
// `min_quantity: null` removes the branch's threshold.
export const setStockAlert = (branchId: string, variantId: string, minQuantity: number | null) =>
  posRequest('PUT', '/pos/stock_alerts', {
    body: { branch_id: branchId, variant_id: variantId, min_quantity: minQuantity },
    idempotencyKey: crypto.randomUUID(),
  })

// A step after the ingredient itself was saved that did not go through. The
// ingredient is kept; saving again repeats only what is still missing.
export type IngredientFollowUp = { step: 'unit' | 'alert'; error: unknown }
export type StoredIngredient = {
  productId: string
  variantId: string
  unitCode: string
  alert: number | null
}
export type IngredientSaveOutcome = {
  stored: StoredIngredient
  failures: IngredientFollowUp[]
}
export type IngredientSaveContext = {
  currency: string
  ensureProductTypes: () => Promise<ProductTypeIds>
  // Distinct selling stock locations of the store's active branches.
  locationIds: string[]
  // The selected branch, when its threshold may be written here.
  alertBranchId: string | null
  existing?: StoredIngredient
}

// Saves the ingredient, then its unit and threshold. A refusal of the product
// itself (409, 422) is thrown untouched so the form can map it; a later
// step's refusal is reported in `failures` instead.
export async function saveIngredient(
  value: ParsedIngredient,
  context: IngredientSaveContext,
): Promise<IngredientSaveOutcome> {
  const types = await context.ensureProductTypes()
  const sku = value.sku || (await generateSku(adminClient, INGREDIENT_SKU_PREFIX))
  const parsed = { ...value, sku }
  const existing = context.existing
  const product = existing
    ? await adminClient.products.update(
        existing.productId,
        ingredientUpdateBody(parsed, { currency: context.currency, variantId: existing.variantId }),
      )
    : await adminClient.products.create(
        ingredientCreateBody(parsed, {
          currency: context.currency,
          productTypeId: types.ingredient,
          locationIds: context.locationIds,
        }),
      )
  const stored: StoredIngredient = {
    productId: product.id,
    variantId: product.default_variant_id,
    unitCode: existing?.unitCode ?? 'item',
    alert: existing?.alert ?? null,
  }
  const failures: IngredientFollowUp[] = []
  if (parsed.unitCode !== stored.unitCode) {
    try {
      await setStockUnit(stored.variantId, parsed.unitCode)
      stored.unitCode = parsed.unitCode
    } catch (error) {
      failures.push({ step: 'unit', error })
    }
  }
  const branchId = context.alertBranchId
  if (branchId && parsed.alert !== stored.alert) {
    try {
      await setStockAlert(branchId, stored.variantId, parsed.alert)
      stored.alert = parsed.alert
    } catch (error) {
      failures.push({ step: 'alert', error })
    }
  }
  return { stored, failures }
}
