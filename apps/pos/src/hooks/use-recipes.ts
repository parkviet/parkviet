import { useResourceMutation } from '@spree/dashboard-core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

// Recipes of menu sizes and options, and a branch's low-stock thresholds.
// Quantities the server returns are in each ingredient's stock unit.

export type RecipeOwnerRef = { variant_id: string } | { modifier_option_id: string }

export type RecipeIngredient = {
  id: string
  variant_id: string
  name: string | null
  sku: string | null
  options_text: string | null
  quantity: string
  unit_code: string
  base_quantity: number
  base_unit: string
  unit_cost: string | null
  cost: string | null
}

export type RecipeOwner = {
  owner_type: 'variant' | 'modifier_option'
  owner_id: string
  track_inventory: boolean | null
  active: {
    id: string
    version: number
    active: boolean
    created_at: string
    estimated_cost: string | null
    ingredients: RecipeIngredient[]
  } | null
  versions: {
    id: string
    version: number
    active: boolean
    created_at: string
    ingredients: number
  }[]
}

export type RecipeRow = { variant_id: string; quantity: string; unit_code: string }

export type StockAlert = {
  id: string
  branch_id: string
  variant_id: string
  name: string | null
  sku: string | null
  options_text: string | null
  base_unit: string
  min_quantity: number
  on_hand: number
  low: boolean
}

// One card of the store's recipe list (`GET /pos/recipes/list`).
export type RecipeListRow = {
  id: string
  version: number
  ingredients: number
  estimated_cost: string | null
  owner_type: 'variant' | 'modifier_option'
  owner_id: string
  product_id: string | null
  name: string
  options_text: string | null
  sku: string | null
  group_name: string | null
  cost_price: string | null
  track_inventory: boolean | null
}
export type RecipeListMeta = { page: number; pages: number; count: number; next: number | null }
export type RecipeListParams = {
  q?: string
  page?: number
  limit?: number
  owner_type?: 'variant' | 'modifier_option'
  variant_ids?: string
}

export const readRecipeList = (params: RecipeListParams) =>
  posRequest<{ data: RecipeListRow[]; meta: RecipeListMeta }>('GET', '/pos/recipes/list', {
    params: Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ),
  })
export function useRecipeList(params: RecipeListParams, enabled = true) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'goods', 'recipes', params),
    enabled,
    placeholderData: (previous) => previous,
    queryFn: () => readRecipeList(params),
  })
}

export function useRecipe(owner: RecipeOwnerRef | null) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'recipes', owner),
    enabled: Boolean(owner),
    queryFn: async () =>
      (await posRequest<{ data: RecipeOwner }>('GET', '/pos/recipes', { params: owner ?? {} }))
        .data,
  })
}

export function useSaveRecipe() {
  const client = useQueryClient()
  const { storeId } = useSession()
  return useResourceMutation({
    mutationFn: (
      body: RecipeOwnerRef & { ingredients: RecipeRow[]; confirm_stock_write_off?: boolean },
    ) =>
      posRequest<{ data: RecipeOwner }>('PUT', '/pos/recipes', {
        body,
        idempotencyKey: crypto.randomUUID(),
      }),
    successMessage: false,
    errorMessage: false,
    onSuccess: () => client.invalidateQueries({ queryKey: ['pos', storeId] }),
  })
}

export function useStockAlerts(branchId: string | null) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'stock-alerts', branchId),
    enabled: Boolean(branchId),
    queryFn: async () =>
      (
        await posRequest<{ data: StockAlert[] }>('GET', '/pos/stock_alerts', {
          params: { branch_id: branchId ?? undefined },
        })
      ).data,
  })
}

// `min_quantity: null` removes the threshold.
export function useSetStockAlert() {
  const client = useQueryClient()
  const { storeId } = useSession()
  return useResourceMutation({
    mutationFn: (body: { branch_id: string; variant_id: string; min_quantity: number | null }) =>
      posRequest<{ data: StockAlert[] }>('PUT', '/pos/stock_alerts', {
        body,
        idempotencyKey: crypto.randomUUID(),
      }),
    successMessage: false,
    errorMessage: false,
    onSuccess: () => client.invalidateQueries({ queryKey: ['pos', storeId] }),
  })
}
