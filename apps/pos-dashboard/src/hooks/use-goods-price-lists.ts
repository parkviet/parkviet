import type { PriceBulkUpsertRowParams, PriceParams } from '@spree/admin-sdk'
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
