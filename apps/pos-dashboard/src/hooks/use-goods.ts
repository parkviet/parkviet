import type { PosBranch } from '@parkviet/pos-shared/types/pos-context'
import { adminClient, useResourceMutation } from '@spree/dashboard-core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listAll, POS_CHANNEL_CODE, productTypesByKind } from './use-goods-setup'
import { useSession } from './use-session'
import { useBranches } from './use-topology'

// Read wrappers over the Spree catalog the goods screens share. Records stay
// Spree's (Admin API v3 through the SDK); every key starts
// ['pos', storeId, 'goods', ...] so a store's POS invalidation reaches them.

export const goodsKey = (storeId: string, ...parts: unknown[]) =>
  ['pos', storeId, 'goods', ...parts] as const

export type ProductListParams = NonNullable<Parameters<typeof adminClient.products.list>[0]>

function useGoodsQuery<T>(parts: unknown[], enabled: boolean, read: () => Promise<T>) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: goodsKey(storeId, ...parts),
    enabled: enabled && status === 'authenticated',
    queryFn: read,
  })
}

// One page of products, as the list screens page through them.
export const useGoodsProducts = (params: ProductListParams, enabled = true) =>
  useGoodsQuery(['products', params], enabled, () => adminClient.products.list(params))
export const useGoodsProduct = (id: string, expand: string[] = [], enabled = true) =>
  useGoodsQuery(['product', id, expand], enabled && id !== '', () =>
    adminClient.products.get(id, expand.length > 0 ? { expand } : undefined),
  )

const ALL = { limit: 100 } as const
export const useGoodsCategories = (enabled = true) =>
  useGoodsQuery(['categories'], enabled, () =>
    listAll((page) => adminClient.categories.list({ ...ALL, page, sort: 'position' })),
  )
// The store's product types with the POS kinds recognized among them.
export const useGoodsProductTypes = (enabled = true) =>
  useGoodsQuery(['product-types'], enabled, async () => {
    const types = await listAll((page) => adminClient.productTypes.list({ ...ALL, page }))
    return { types, byKind: productTypesByKind(types) }
  })
export const useGoodsTaxCategories = (enabled = true) =>
  useGoodsQuery(['tax-categories'], enabled, () =>
    listAll((page) => adminClient.taxCategories.list({ ...ALL, page })),
  )
// The `pos` channel as it stands, without creating it (reading needs `read_settings`).
export const usePosChannel = (enabled = true) =>
  useGoodsQuery(['pos-channel'], enabled, async () => {
    const { data } = await adminClient.channels.list({ code_eq: POS_CHANNEL_CODE, limit: 100 })
    return data.find((channel) => channel.code === POS_CHANNEL_CODE) ?? null
  })

// Each POS branch sells from one Spree stock location (`branch.stock_location_id`,
// required and store-checked on the server); an optional receiving location
// takes deliveries. Stock shown or set for a branch is that location's.
export type BranchStockLocation = {
  branchId: string
  branchName: string
  stockLocationId: string
  receivingStockLocationId: string | null
}
export const branchStockLocations = (
  branches: readonly Pick<
    PosBranch,
    'id' | 'name' | 'stock_location_id' | 'receiving_stock_location_id'
  >[],
): BranchStockLocation[] =>
  branches.map((branch) => ({
    branchId: branch.id,
    branchName: branch.name,
    stockLocationId: branch.stock_location_id,
    receivingStockLocationId: branch.receiving_stock_location_id,
  }))
export function useBranchStockLocations(enabled = true) {
  const branches = useBranches(enabled)
  return { ...branches, data: branches.data && branchStockLocations(branches.data.data) }
}

// A catalog write through the SDK. Refusals reach the caller untouched so
// 409 reasons and 422 field details stay readable; every POS query of the
// store is refreshed afterwards (branch assortment reads the same products).
export function useGoodsWrite<TVariables, TResult>(
  write: (variables: TVariables) => Promise<TResult>,
) {
  const client = useQueryClient()
  const { storeId } = useSession()
  return useResourceMutation({
    mutationFn: write,
    successMessage: false,
    errorMessage: false,
    onSuccess: () => client.invalidateQueries({ queryKey: ['pos', storeId] }),
  })
}
