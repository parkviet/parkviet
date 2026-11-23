import type { PriceParams } from '@spree/admin-sdk'
import { adminClient } from '@spree/dashboard-core'
import { useQuery } from '@tanstack/react-query'
import { basePriceByVariant } from '../lib/goods-barcode-labels'
import { fetchCatalogPage } from './use-catalog'
import { goodsKey } from './use-goods'
import { listAll } from './use-goods-setup'
import { useSession } from './use-session'

// Reads of the barcode label screen. Variants, stock and the POS channel price
// come from the branch catalog (`GET /pos/catalog`, the same list the label
// dialog adds from); the variant's own price is its Spree base price.

// Base prices (no price list) of the given variants in the store's currency.
export function useVariantBasePrices(variantIds: readonly string[], currency: string) {
  const { storeId, status } = useSession()
  const ids = [...new Set(variantIds)].sort()
  return useQuery({
    queryKey: goodsKey(storeId, 'base-prices', ids, currency),
    enabled: status === 'authenticated' && ids.length > 0,
    queryFn: async () =>
      basePriceByVariant(
        await listAll((page) =>
          adminClient.prices.list({
            limit: 100,
            page,
            variant_id_in: ids,
            price_list_id_null: true,
            currency_eq: currency as PriceParams['currency'],
          }),
        ),
      ),
  })
}

// A scanned code: the branch's variants carrying exactly this barcode.
export async function findVariantsByBarcode(branchId: string, code: string) {
  return (await fetchCatalogPage(branchId, { q: code, barcode: true, limit: 2 })).data
}
