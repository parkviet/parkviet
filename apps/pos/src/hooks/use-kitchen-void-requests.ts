import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

export const KITCHEN_VOID_ACTION = 'kitchen.void_sent'
export type VoidRequestGroup = 'pending' | 'handled'
export type VoidRequestStatus = 'pending' | 'granted' | 'declined' | 'expired' | 'canceled'

// A request to take back a dish already sent to the kitchen. The label names
// the table or order only, never the dish or the guest.
export type KitchenVoidRequest = {
  id: string
  branch_id: string
  requester_name: string | null
  subject_label: string | null
  reason: string | null
  status: VoidRequestStatus
  decided_by_name: string | null
  decided_at: string | null
  expires_at: string
  created_at: string
}

const STATUSES: Record<VoidRequestGroup, VoidRequestStatus[]> = {
  pending: ['pending'],
  handled: ['granted', 'declined', 'expired'],
}
const PAGE = '100'
export const VOID_REQUEST_REFRESH_MS = 10_000

export function useKitchenVoidRequests(branchId: string, group: VoidRequestGroup) {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'kitchen', 'void-requests', branchId, group),
    enabled: Boolean(branchId),
    refetchInterval: VOID_REQUEST_REFRESH_MS,
    queryFn: () =>
      posRequest<{ data: KitchenVoidRequest[]; meta: { count: number } }>(
        'GET',
        '/pos/approval_requests',
        {
          params: {
            branch_id: branchId,
            'action[]': [KITCHEN_VOID_ACTION],
            'status[]': STATUSES[group],
            limit: PAGE,
          },
        },
      ),
  })
}

export function useDecideVoidRequest() {
  const client = useQueryClient()
  const { storeId } = useSession()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'grant' | 'decline' }) =>
      posRequest<{ data: KitchenVoidRequest }>('POST', `/pos/approval_requests/${id}/${decision}`, {
        body: {},
        idempotencyKey: crypto.randomUUID(),
      }),
    onSettled: () =>
      client.invalidateQueries({ queryKey: posKey(storeId, 'kitchen', 'void-requests') }),
  })
}
