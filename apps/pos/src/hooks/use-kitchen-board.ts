import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { replaceTicket } from '../lib/kitchen-board'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import type { KitchenStation } from './use-kitchen'
import { useSession } from './use-session'

export type KitchenItemStatus = 'new' | 'preparing' | 'ready' | 'served' | 'voided'

export type KitchenTicketItem = {
  id: string
  sale_line_id: string | null
  name: string
  modifiers: { name: string; group_name?: string | null; quantity: number }[]
  components: { name: string; quantity: string }[]
  note: string | null
  quantity: string
  status: KitchenItemStatus
  started_at: string | null
  ready_at: string | null
  served_at: string | null
  voided_at: string | null
  recalled_at: string | null
  recall_count: number
  prep_seconds: number | null
  late: boolean
  seat: number | null
  course: number | null
  priority: boolean
  priority_at: string | null
}

// What the ticket header carries: the table, a platform pickup code, the order.
export type KitchenTicketHeader = {
  table?: string
  pickup_code?: string
  platform_order_ref?: string
  order_number?: string
  guest_name?: string
  customer_name?: string
  register_name?: string
  note?: string
  order_source?: string
  service_mode?: string
}

export type KitchenTicket = {
  id: string
  workspace_id: string
  branch_id: string
  kitchen_station_id: string
  station_name: string
  station_kind: string
  sequence: number
  kind: 'fire' | 'void'
  service_mode: string
  business_date: string
  header: KitchenTicketHeader | null
  sent_at: string
  done: boolean
  done_at: string | null
  priority: boolean
  items: KitchenTicketItem[]
}

// The open items added up by dish and options, for the "by dish" view.
export type KitchenAllDayRow = {
  key: string
  name: string
  modifiers: { name: string; group_name?: string | null; quantity: number }[]
  quantity: string
  oldest_sent_at: string
  priority: boolean
  item_ids: string[]
}

// Ready items waiting at the pass, one row per order.
export type KitchenExpoOrder = {
  workspace_id: string
  header: KitchenTicketHeader | null
  service_mode: string
  ready_since: string | null
  items: { item: KitchenTicketItem; kitchen_ticket_id: string; station_name: string }[]
}

export type KitchenBoard = {
  branch_id: string
  stations: KitchenStation[]
  service_mode: string | null
  server_now: string
  open: KitchenTicket[]
  done: KitchenTicket[]
  all_day: KitchenAllDayRow[]
  expo: KitchenExpoOrder[]
}

export const KITCHEN_BOARD_REFRESH_MS = 5000

const boardPrefix = (storeId: string) => posKey(storeId, 'kitchen', 'board')

// The board of a branch, read again every few seconds: the kitchen screen is
// worked from several devices and the dashboard has no live channel.
export function useKitchenBoard(
  branchId: string,
  { stationIds, priorityOnly }: { stationIds: readonly string[]; priorityOnly: boolean },
  enabled = true,
) {
  const { storeId } = useSession()
  const stations = [...stationIds].sort()
  return useQuery({
    queryKey: posKey(storeId, 'kitchen', 'board', branchId, stations, priorityOnly),
    enabled: enabled && Boolean(branchId),
    refetchInterval: KITCHEN_BOARD_REFRESH_MS,
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (
        await posRequest<{ data: KitchenBoard }>('GET', '/pos/kitchen/board', {
          params: {
            branch_id: branchId,
            station_ids: stations.length > 0 ? stations.join(',') : undefined,
            priority: priorityOnly ? '1' : undefined,
          },
        })
      ).data,
  })
}

function patchBoards(client: QueryClient, storeId: string, tickets: KitchenTicket[]) {
  client.setQueriesData<KitchenBoard>({ queryKey: boardPrefix(storeId) }, (board) =>
    board ? tickets.reduce(replaceTicket, board) : board,
  )
}

// A refused command (409: another device moved the item first) still leaves
// the board stale, so every outcome reads it again.
function useBoardMutation<TVariables>(run: (variables: TVariables) => Promise<KitchenTicket[]>) {
  const client = useQueryClient()
  const { storeId } = useSession()
  return useMutation({
    mutationFn: run,
    onSuccess: (tickets) => patchBoards(client, storeId, tickets),
    onSettled: () => client.invalidateQueries({ queryKey: boardPrefix(storeId) }),
  })
}

async function ticketCommand(path: string, body: Record<string, unknown> = {}) {
  return (await posRequest<{ data: KitchenTicket }>('POST', path, { body })).data
}

export type KitchenItemAction = 'start' | 'ready' | 'serve' | 'recall'

export const useKitchenItemAction = () =>
  useBoardMutation(async ({ itemId, action }: { itemId: string; action: KitchenItemAction }) => [
    await ticketCommand(`/pos/kitchen/items/${itemId}/${action}`),
  ])

export const useBumpTicket = () =>
  useBoardMutation(async (ticketId: string) => [
    await ticketCommand(`/pos/kitchen/tickets/${ticketId}/bump`),
  ])

export const useBumpAllDay = () =>
  useBoardMutation(
    async ({
      branchId,
      stationIds,
      key,
    }: {
      branchId: string
      stationIds: readonly string[]
      key: string
    }) =>
      (
        await posRequest<{ data: KitchenTicket[] }>('POST', '/pos/kitchen/all_day/bump', {
          body: {
            branch_id: branchId,
            station_ids: stationIds.length > 0 ? stationIds.join(',') : undefined,
            key,
            quantity: 1,
          },
        })
      ).data,
  )

// Marks one dish, or every dish of a ticket still to make, urgent (or not).
export const useSetPriority = () =>
  useBoardMutation(
    async ({
      target,
      id,
      priority,
    }: {
      target: 'item' | 'ticket'
      id: string
      priority: boolean
    }) => [
      await ticketCommand(
        `/pos/kitchen/${target === 'item' ? 'items' : 'tickets'}/${id}/priority`,
        {
          priority,
        },
      ),
    ],
  )
