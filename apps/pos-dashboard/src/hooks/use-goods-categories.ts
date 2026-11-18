import type { Product } from '@spree/admin-sdk'
import { adminClient } from '@spree/dashboard-core'
import { useQuery } from '@tanstack/react-query'
import { membershipChanges } from '../lib/goods-categories'
import { goodsKey } from './use-goods'
import { listAll } from './use-goods-setup'
import { useSession } from './use-session'

// Reads and the save sequence of the goods categories screen. Categories and
// their product membership are Spree's (`/categories`, `/categories/:id/products`).

// The default variant carries the SKU a product row shows.
const SKU_EXPAND = ['default_variant']

// Every product filed under a category, in the category's own order.
export const readCategoryProducts = (categoryId: string) =>
  listAll((page) =>
    adminClient.categories.products.list(categoryId, { page, limit: 100, expand: SKU_EXPAND }),
  )

export function useCategoryProducts(categoryId: string | undefined) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'category-products', categoryId),
    enabled: Boolean(categoryId) && status === 'authenticated',
    queryFn: () => readCategoryProducts(categoryId as string),
  })
}

// One page of the store's products to pick from, searched by name, SKU or
// barcode with the server's `search_with_barcode` scope.
export const PICKER_PAGE_SIZE = 10
export function useProductPicker(term: string, page: number) {
  const { storeId, status } = useSession()
  const search = term.trim()
  return useQuery({
    queryKey: goodsKey(storeId, 'category-picker', search, page),
    enabled: status === 'authenticated',
    placeholderData: (previous) => previous,
    queryFn: () =>
      adminClient.products.list({
        page,
        limit: PICKER_PAGE_SIZE,
        sort: 'name',
        expand: SKU_EXPAND,
        ...(search ? { q: { search_with_barcode: search } } : {}),
      }),
  })
}

// What the category is on the server, as far as this save knows it.
export type SavedCategory = {
  id?: string
  name: string
  parentId: string | null
  productIds: string[]
}
export type CategoryDraft = Omit<SavedCategory, 'id'> & {
  // The 0-based index that places it last under a new parent.
  lastIndex: number
}

// Creates or updates the category, then adds and removes products so its
// members are the draft's. Each finished step is reported through `progress`,
// so a save that failed midway is retried from what was saved and never
// creates a second category.
export async function saveCategory(
  saved: SavedCategory,
  draft: CategoryDraft,
  progress: (saved: SavedCategory) => void,
): Promise<string> {
  let current = saved
  const step = (next: Partial<SavedCategory>) => {
    current = { ...current, ...next }
    progress(current)
  }
  if (!current.id) {
    const created = await adminClient.categories.create({
      name: draft.name,
      ...(draft.parentId ? { parent_id: draft.parentId } : {}),
    })
    step({ id: created.id, name: draft.name, parentId: draft.parentId, productIds: [] })
  }
  const id = current.id as string
  if (current.name !== draft.name) {
    await adminClient.categories.update(id, { name: draft.name })
    step({ name: draft.name })
  }
  // A plain update cannot move a category to the top level; reposition can do both.
  if (current.parentId !== draft.parentId) {
    await adminClient.categories.reposition(id, {
      new_parent_id: draft.parentId,
      new_position: draft.lastIndex,
    })
    step({ parentId: draft.parentId })
  }
  const { add, remove } = membershipChanges(current.productIds, draft.productIds)
  if (remove.length > 0) {
    await adminClient.categories.products.delete(id, remove)
    step({ productIds: current.productIds.filter((productId) => !remove.includes(productId)) })
  }
  if (add.length > 0) {
    await adminClient.categories.products.create(id, add)
    step({ productIds: [...current.productIds, ...add] })
  }
  return id
}

// A product as the picker and the selected list show it.
export type PickedProduct = { id: string; name: string; sku: string; thumbnailUrl: string | null }
export const pickedProduct = (product: Product): PickedProduct => ({
  id: product.id,
  name: product.name,
  sku: product.default_variant?.sku ?? '',
  thumbnailUrl: product.thumbnail_url ?? null,
})
