import type {
  PriceBulkUpsertRowParams,
  PriceList,
  PriceListUpdateParams,
  PriceParams,
} from '@spree/admin-sdk'
import { adminClient } from '@spree/dashboard-core'
import { useQuery } from '@tanstack/react-query'
import { goodsKey } from './use-goods'
import { listAll } from './use-goods-setup'
import { useSession } from './use-session'

// The store's Spree price lists as the product form shows them, and the
// product's own prices in them. Lists owned by a catalog are priced with
// their catalog and left out.

export function useGoodsPriceLists(enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'price-lists'),
    enabled: enabled && status === 'authenticated',
    queryFn: () =>
      listAll((page) =>
        adminClient.priceLists.list({
          limit: 100,
          page,
          sort: 'position',
          catalog_id_null: true,
          expand: ['price_rules'],
        }),
      ),
  })
}

// Every list price of the given variants in the store's currency.
export function useProductListPrices(variantIds: string[], currency: string, enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'list-prices', variantIds, currency),
    enabled: enabled && status === 'authenticated' && variantIds.length > 0,
    queryFn: () =>
      listAll((page) =>
        adminClient.prices.list({
          limit: 100,
          page,
          variant_id_in: variantIds,
          price_list_id_not_null: true,
          currency_eq: currency as PriceParams['currency'],
        }),
      ),
  })
}

// Saves one list's prices for a product: the product joins the list first
// (already a member is skipped), then changed rows are upserted and removed
// quantity breaks deleted.
export async function saveListPrices(input: {
  listId: string
  productId: string
  join: boolean
  upserts: PriceBulkUpsertRowParams[]
  destroyIds: string[]
}) {
  if (input.join) await adminClient.priceLists.products.create(input.listId, [input.productId])
  if (input.destroyIds.length > 0) await adminClient.prices.bulkDestroy({ ids: input.destroyIds })
  if (input.upserts.length > 0) await adminClient.prices.bulkUpsert({ prices: input.upserts })
}

export const removeFromPriceList = (input: { listId: string; productId: string }) =>
  adminClient.priceLists.products.delete(input.listId, [input.productId])

// --- The price lists screen.

// Catalogs this screen created to price a list for customer groups carry
// this metadata flag; other catalogs (agreements set up in Spree) are left alone.
export const POS_CATALOG_FLAG = 'pos_price_list'

export type ScreenCatalog = { id: string; groupIds: string[]; groupNames: string[] }
export type ScreenEntry = { list: PriceList; catalog: ScreenCatalog | null }

// Standalone lists, then the lists of this screen's customer-group catalogs.
export async function readPriceListScreen(): Promise<ScreenEntry[]> {
  const [lists, catalogs] = await Promise.all([
    listAll((page) =>
      adminClient.priceLists.list({
        limit: 100,
        page,
        sort: 'position',
        catalog_id_null: true,
        expand: ['price_rules'],
      }),
    ),
    listAll((page) =>
      adminClient.catalogs.list({
        limit: 100,
        page,
        expand: ['price_list', 'price_list.price_rules', 'assignments'],
      }),
    ),
  ])
  const owned = catalogs.flatMap((catalog): ScreenEntry[] => {
    if (catalog.metadata?.[POS_CATALOG_FLAG] !== true || !catalog.price_list) return []
    const groups = (catalog.assignments ?? []).filter(
      (row) => row.assignable_type === 'customer_group',
    )
    return [
      {
        list: catalog.price_list,
        catalog: {
          id: catalog.id,
          groupIds: groups.map((row) => row.assignable_id),
          groupNames: groups.map((row) => row.assignable_name ?? row.assignable_id),
        },
      },
    ]
  })
  return [...lists.map((list) => ({ list, catalog: null })), ...owned]
}

export function usePriceListScreen() {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'price-list-screen'),
    enabled: status === 'authenticated',
    queryFn: readPriceListScreen,
  })
}

// The store's Spree customer groups (reading them needs `read_customers`).
export function useCustomerGroups(enabled: boolean) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'customer-groups'),
    enabled: enabled && status === 'authenticated',
    queryFn: () =>
      listAll((page) => adminClient.customerGroups.list({ limit: 100, page, sort: 'name' })),
  })
}

// The store's sales channels (reading them needs `read_settings`).
export function useSalesChannels(enabled: boolean) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'channels'),
    enabled: enabled && status === 'authenticated',
    queryFn: () => listAll((page) => adminClient.channels.list({ limit: 100, page })),
  })
}

export type ListPayload = PriceListUpdateParams & { name: string }
// What a save has already written, so a retried save never creates twice and
// still switches on a list whose activation did not go through. A group
// list's id is null until its catalog has been read back.
export type SavedPriceList = { listId: string | null; catalogId: string | null; activated: boolean }

// Creates or updates a list. A list for customer groups is the price list of
// a catalog assigned to those groups (Spree's audience model); it is created
// with the catalog and the catalog is switched on. A new standalone list is
// switched on too, which Spree turns into scheduled when it starts later.
// Every write reports what it did through `progress` before the next starts.
export async function savePriceList(input: {
  saved: SavedPriceList | null
  payload: ListPayload
  groupIds: string[] | null
  progress: (saved: SavedPriceList) => void
}): Promise<SavedPriceList & { listId: string }> {
  const { payload, groupIds } = input
  const assignments = (groupIds ?? []).map((id) => ({
    assignable_type: 'customer_group' as const,
    assignable_id: id,
  }))
  let saved = input.saved
  const record = (next: SavedPriceList) => {
    input.progress(next)
    return next
  }
  const written = saved !== null
  if (!saved) {
    if (groupIds) {
      const catalog = await adminClient.catalogs.create({
        name: payload.name,
        metadata: { [POS_CATALOG_FLAG]: true },
        price_list: payload,
        assignments,
      })
      saved = record({ listId: null, catalogId: catalog.id, activated: false })
    } else {
      const list = await adminClient.priceLists.create(payload)
      saved = record({ listId: list.id, catalogId: null, activated: false })
    }
  }
  if (saved.catalogId && !saved.listId) {
    const read = await adminClient.catalogs.get(saved.catalogId, { expand: ['price_list'] })
    if (!read.price_list) throw new Error('The catalog was saved without its price list.')
    saved = record({ ...saved, listId: read.price_list.id })
  }
  const listId = saved.listId
  if (!listId) throw new Error('The catalog was saved without its price list.')
  if (written) {
    await adminClient.priceLists.update(listId, payload)
    if (saved.catalogId)
      await adminClient.catalogs.update(saved.catalogId, { name: payload.name, assignments })
  }
  if (!saved.activated) {
    if (saved.catalogId) await adminClient.catalogs.activate(saved.catalogId)
    else await adminClient.priceLists.activate(listId)
    saved = record({ ...saved, activated: true })
  }
  return { ...saved, listId }
}

// Deleting a customer-group list deletes its catalog, which deletes the list.
export const deletePriceList = (entry: { listId: string; catalogId: string | null }) =>
  entry.catalogId
    ? adminClient.catalogs.delete(entry.catalogId)
    : adminClient.priceLists.delete(entry.listId)

export const setPriceListActive = (input: { listId: string; active: boolean }) =>
  input.active
    ? adminClient.priceLists.activate(input.listId)
    : adminClient.priceLists.deactivate(input.listId)

// The products of a list with their variants and base prices.
export type ListProduct = {
  id: string
  name: string
  thumbnailUrl: string | null
  variants: { id: string; label: string; sku: string; basePrice: string | null }[]
}
export async function readListProducts(listId: string): Promise<ListProduct[]> {
  const members = await listAll((page) =>
    adminClient.priceLists.products.list(listId, { limit: 100, page }),
  )
  const products: ListProduct[] = []
  for (let start = 0; start < members.length; start += 100) {
    const ids = members.slice(start, start + 100).map((row) => row.id)
    const page = await adminClient.products.list({ limit: 100, id_in: ids, expand: ['variants'] })
    for (const product of page.data)
      products.push({
        id: product.id,
        name: product.name,
        thumbnailUrl: product.thumbnail_url ?? null,
        variants: (product.variants ?? []).map((variant) => ({
          id: variant.id,
          label: variant.options_text || product.name,
          sku: variant.sku ?? '',
          basePrice: variant.price?.amount ?? null,
        })),
      })
  }
  const order = new Map(members.map((row, index) => [row.id, index]))
  return products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

export function useListProducts(listId: string | null) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'price-list-products', listId),
    enabled: Boolean(listId) && status === 'authenticated',
    queryFn: () => readListProducts(listId as string),
  })
}

// Every price the list holds in the store's currency.
export function useListPrices(listId: string | null, currency: string) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, 'list-prices', 'list', listId, currency),
    enabled: Boolean(listId) && status === 'authenticated',
    queryFn: () =>
      listAll((page) =>
        adminClient.prices.list({
          limit: 100,
          page,
          price_list_id_eq: listId as string,
          currency_eq: currency as PriceParams['currency'],
        }),
      ),
  })
}

// Adds products to a list, then writes the prices worked out for them.
export async function addListProducts(input: {
  listId: string
  productIds: string[]
  upserts: PriceBulkUpsertRowParams[]
}) {
  await adminClient.priceLists.products.create(input.listId, input.productIds)
  if (input.upserts.length > 0) await adminClient.prices.bulkUpsert({ prices: input.upserts })
}

export const writeListPrices = (upserts: PriceBulkUpsertRowParams[]) =>
  adminClient.prices.bulkUpsert({ prices: upserts })
