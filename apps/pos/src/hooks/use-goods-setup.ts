import { adminClient, usePermissions } from '@spree/dashboard-core'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { canCreatePosChannel, canReadProductTypes, canWriteProductTypes } from '../lib/pos-access'
import { useSession } from './use-session'

// What goods screens need before they write: the store's `pos` sales channel
// (the server resolves POS selling through that code, see
// `Spree::Pos::SalesChannel`) and the three POS product types. Both are
// ensured only when a product or ingredient is about to be saved, never while
// someone merely looks, and both are idempotent.

export const POS_CHANNEL_CODE = 'pos'
export const POS_CHANNEL_NAME = 'Point of Sale'

export const PRODUCT_KINDS = ['goods', 'prepared', 'service', 'ingredient'] as const
export type ProductKind = (typeof PRODUCT_KINDS)[number]
// Spree 6.0 product types carry no metadata, so a kind is recognized by the
// fixed name it is created with. Names are compared without case, spacing or
// Vietnamese marks, so "Hàng hóa" (either accent placement) or a type renamed
// to "hang hoa" still count, while any other type is left alone.
export const PRODUCT_TYPE_NAMES: Record<ProductKind, string> = {
  goods: 'Sản phẩm thường',
  prepared: 'Sản phẩm chế biến',
  service: 'Dịch vụ',
  ingredient: 'Nguyên liệu',
}

const fold = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
// Names used before the kinds were renamed still count as plain products.
const LEGACY_GOODS_NAMES = ['Hàng hoá', 'Sản phẩm']
const KIND_BY_NAME = new Map<string, ProductKind>([
  ...LEGACY_GOODS_NAMES.map((name) => [fold(name), 'goods'] as const),
  ...PRODUCT_KINDS.map((kind) => [fold(PRODUCT_TYPE_NAMES[kind]), kind] as const),
])
export const productKindOf = (name: string): ProductKind | null =>
  KIND_BY_NAME.get(fold(name)) ?? null

type Named = { id: string; name: string }
// The first product type of each kind; later duplicates are ignored.
export function productTypesByKind<T extends Named>(types: readonly T[]) {
  const found: Partial<Record<ProductKind, T>> = {}
  for (const type of types) {
    const kind = productKindOf(type.name)
    if (kind && !found[kind]) found[kind] = type
  }
  return found
}

export type PosChannel = { id: string; active: boolean; created: boolean }
export type ProductTypeIds = Record<ProductKind, string>

// Refusals the screens translate: `goods.setup.<reason>`.
export class GoodsSetupError extends Error {
  constructor(
    readonly reason:
      | 'pos_channel_forbidden'
      | 'product_types_forbidden'
      | 'product_types_unreadable',
  ) {
    super(reason)
    this.name = 'GoodsSetupError'
  }
}

type Client = Pick<typeof adminClient, 'channels' | 'productTypes'>
type Page<T> = { data: T[]; meta: { next: number | null } }
export async function listAll<T>(read: (page: number) => Promise<Page<T>>) {
  const data: T[] = []
  for (let page: number | null = 1; page !== null; ) {
    const result = await read(page)
    data.push(...result.data)
    page = result.meta.next
  }
  return data
}

const findPosChannel = async (client: Client) => {
  const { data } = await client.channels.list({ code_eq: POS_CHANNEL_CODE, limit: 100 })
  return data.find((channel) => channel.code === POS_CHANNEL_CODE)
}
// Finds the store's `pos` channel or creates it active and not the default.
// An inactive channel is returned as it is: switching it back on is the
// store's decision, and the POS reports it as switched off. A create that
// loses a race to another tab is answered by the channel that won.
export async function ensurePosChannel(
  { canCreate }: { canCreate: boolean },
  client: Client = adminClient,
): Promise<PosChannel> {
  const existing = await findPosChannel(client)
  if (existing) return { id: existing.id, active: existing.active, created: false }
  if (!canCreate) throw new GoodsSetupError('pos_channel_forbidden')
  try {
    const channel = await client.channels.create({
      name: POS_CHANNEL_NAME,
      code: POS_CHANNEL_CODE,
      active: true,
      default: false,
    })
    return { id: channel.id, active: channel.active, created: true }
  } catch (error) {
    const winner = await findPosChannel(client)
    if (winner) return { id: winner.id, active: winner.active, created: false }
    throw error
  }
}

const readProductTypes = (client: Client) =>
  listAll((page) => client.productTypes.list({ page, limit: 100 }))
// Makes sure the three POS product types exist and returns their ids.
export async function ensureProductTypes(
  { canRead = true, canCreate }: { canRead?: boolean; canCreate: boolean },
  client: Client = adminClient,
): Promise<ProductTypeIds> {
  if (!canRead) throw new GoodsSetupError('product_types_unreadable')
  const found = productTypesByKind(await readProductTypes(client))
  const missing = PRODUCT_KINDS.filter((kind) => !found[kind])
  if (missing.length > 0 && !canCreate) throw new GoodsSetupError('product_types_forbidden')
  const ids = {} as ProductTypeIds
  for (const kind of PRODUCT_KINDS) {
    const type = found[kind]
    if (type) {
      ids[kind] = type.id
      continue
    }
    try {
      ids[kind] = (await client.productTypes.create({ name: PRODUCT_TYPE_NAMES[kind] })).id
    } catch (error) {
      const winner = productTypesByKind(await readProductTypes(client))[kind]
      if (!winner) throw error
      ids[kind] = winner.id
    }
  }
  return ids
}

// Binds both to the signed-in staff member's keys. Concurrent saves share one
// check and its result is kept until the save that follows invalidates the
// store's POS queries, so the next save checks again.
export function useGoodsSetup() {
  const client = useQueryClient()
  const { storeId } = useSession()
  const { permissionKeys } = usePermissions()
  const access = { permissionKeys }
  const mayCreateChannel = canCreatePosChannel(access)
  const mayReadTypes = canReadProductTypes(access)
  const mayCreateTypes = canWriteProductTypes(access)
  const ensure = useCallback(
    <T>(part: string, run: () => Promise<T>) =>
      client.fetchQuery({
        queryKey: ['pos', storeId, 'goods', 'setup', part],
        queryFn: run,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    [client, storeId],
  )
  return {
    ensurePosChannel: useCallback(
      () => ensure('channel', () => ensurePosChannel({ canCreate: mayCreateChannel })),
      [ensure, mayCreateChannel],
    ),
    ensureProductTypes: useCallback(
      () =>
        ensure('product-types', () =>
          ensureProductTypes({ canRead: mayReadTypes, canCreate: mayCreateTypes }),
        ),
      [ensure, mayReadTypes, mayCreateTypes],
    ),
  }
}
