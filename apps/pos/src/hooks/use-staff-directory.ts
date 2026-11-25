import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

export type StaffMembershipSummary = {
  id: string
  branch_id: string
  branch_name: string
  staff_id: string
  capabilities: string[]
  custom_capabilities?: string[]
  staff_role: { id: string; name: string } | null
  status: 'active' | 'disabled'
  pin_set: boolean
}

export type StaffMember = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  status: 'active' | 'disabled'
  deactivated_at: string | null
  last_active_at: string | null
  created_at: string | null
  memberships: StaffMembershipSummary[]
}

export type StaffSummary = {
  total: number
  active: number
  disabled: number
  assigned: number
  unassigned: number
}

export type StaffDirectoryResponse = {
  data: StaffMember[]
  meta: {
    page: number
    limit: number
    count: number
    pages: number
    next: number | null
    summary: StaffSummary
  }
}

export type StaffDirectoryParams = {
  q?: string
  status?: string
  branch_id?: string
  page?: number
  limit?: number
}

export function useStaffDirectory(params: StaffDirectoryParams, enabled = true) {
  const snapshot = useSession()
  const queryParams: Record<string, string | undefined> = {
    q: params.q || undefined,
    status: params.status || undefined,
    branch_id: params.branch_id || undefined,
    page: params.page ? String(params.page) : '1',
    limit: params.limit ? String(params.limit) : '50',
  }
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'staff-directory', queryParams),
    enabled: enabled && snapshot.status === 'authenticated',
    queryFn: () =>
      posRequest<StaffDirectoryResponse>('GET', '/pos/staff', { params: queryParams }),
  })
}

export function useStaffMutation() {
  const { storeId } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      method,
      path,
      body,
    }: {
      method: string
      path: string
      body?: Record<string, unknown>
    }) => posRequest(method, path, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'pos' && query.queryKey[1] === storeId,
      })
    },
  })
}
