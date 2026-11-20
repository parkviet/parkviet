import type { PosMenu } from '@parkviet/pos-shared/types/pos-context'
import { useResourceMutation } from '@spree/dashboard-core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddonGroup } from '../lib/goods-addons'
import { posRequest } from '../lib/pos-request'
import type { OperationWrite, ProductPosSettings } from '../lib/product-operations'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

// The store's POS operating data (add-on groups, time-of-day menus, each
// prepared product's kitchen settings, add-ons and combo) and a branch's
// favourites and sold-out marks. Products and categories are Spree records;
// favourites and sold out belong to one branch.

export type MenuSchedule = {
  id: string
  branch_id: string | null
  name: string
  // Shown on the menu while the schedule runs ("Happy hour").
  label?: string | null
  days_of_week: number[]
  starts_at: string
  ends_at: string
  active: boolean
  items: {
    id: string
    product_id: string
    variant_id: string | null
    price: string | null
    hidden: boolean
  }[]
}

export type MenuResource = 'modifier_groups' | 'menu_schedules'

function useMenuQuery<T>(resource: MenuResource, enabled: boolean) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'menu-admin', resource),
    enabled,
    queryFn: async () => (await posRequest<{ data: T[] }>('GET', `/pos/${resource}`)).data,
  })
}

// Tax categories new prepared products start with (chosen in the F&B setup
// step): ids, or null when the store never chose one.
export type MenuTaxDefaults = { food: string | null; alcohol: string | null }

type ProductSettingsBody = {
  data: ProductPosSettings[]
  meta?: { tax_defaults?: MenuTaxDefaults }
}

// Every prepared product of the store and the tax defaults come in one
// answer; both hooks share it.
function useProductSettingsBody<T>(enabled: boolean, select: (body: ProductSettingsBody) => T) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'menu-admin', 'product-settings'),
    enabled,
    queryFn: () => posRequest<ProductSettingsBody>('GET', '/pos/products/settings'),
    select,
  })
}

export const useProductSettings = (enabled: boolean) =>
  useProductSettingsBody(enabled, (body) => body.data)
export const useMenuTaxDefaults = (enabled: boolean) =>
  useProductSettingsBody(
    enabled,
    (body): MenuTaxDefaults => body.meta?.tax_defaults ?? { food: null, alcohol: null },
  )
// Option costs come only to the people who manage the menu or stock.
export const useModifierGroups = (enabled: boolean) =>
  useMenuQuery<AddonGroup>('modifier_groups', enabled)
export const useMenuSchedules = (enabled: boolean) =>
  useMenuQuery<MenuSchedule>('menu_schedules', enabled)

// What the counter of a branch sells from now, with today's sold-out marks.
export function useBranchMenu(branchId: string | null) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'menu-admin', 'branch', branchId),
    enabled: Boolean(branchId),
    queryFn: async () =>
      (
        await posRequest<{ data: PosMenu }>('GET', '/pos/menu', {
          params: { branch_id: branchId ?? undefined },
        })
      ).data,
  })
}

// One write of a product's operating data (settings, combo or add-on groups).
export const putOperation = (write: Pick<OperationWrite, 'path' | 'body'>) =>
  posRequest<{ data: unknown }>('PUT', write.path, {
    body: write.body,
    idempotencyKey: crypto.randomUUID(),
  })

// One menu command. Every write is audited under its own idempotency key;
// refusals reach the caller untouched so 409 reasons and 422 fields stay readable.
export function useMenuWrite() {
  const client = useQueryClient()
  const { storeId } = useSession()
  return useResourceMutation({
    mutationFn: ({ method, path, body }: { method: string; path: string; body?: unknown }) =>
      posRequest<{ data?: unknown }>(method, path, {
        body: body ?? {},
        idempotencyKey: crypto.randomUUID(),
      }),
    successMessage: false,
    errorMessage: false,
    onSuccess: () => client.invalidateQueries({ queryKey: ['pos', storeId] }),
  })
}
