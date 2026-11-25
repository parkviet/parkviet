import { useQuery } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

export type StoreInfoRecord = {
  id: string | null
  name: string | null
  phone: string | null
  admin_email: string | null
  contact_email: string | null
  tax_code: string | null
  representative_id_number: string | null
  representative_id_set: boolean
  opening_time: string | null
  closing_time: string | null
  business_day_cutoff: string
  province_code: string | null
  ward_code: string | null
  province_name: string | null
  ward_name: string | null
  street: string | null
  description: string | null
  logo_url: string | null
  profile_key: string | null
  profile_keys: string[]
  interests: string[]
  filled: number
  filled_total: number
  open_shifts: number
  fallback: {
    name: string | null
    phone: string | null
    contact_email: string | null
    address: string | null
    logo_url: string | null
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function normalizeStoreInfo(value: unknown): StoreInfoRecord {
  const row = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const fallback = (
    typeof row.fallback === 'object' && row.fallback !== null ? row.fallback : {}
  ) as Record<string, unknown>
  const keys = Array.isArray(row.profile_keys)
    ? row.profile_keys.filter((key): key is string => typeof key === 'string')
    : []
  return {
    id: text(row.id),
    name: text(row.name),
    phone: text(row.phone),
    admin_email: text(row.admin_email),
    contact_email: text(row.contact_email),
    tax_code: text(row.tax_code),
    representative_id_number: text(row.representative_id_number),
    representative_id_set: row.representative_id_set === true,
    opening_time: text(row.opening_time),
    closing_time: text(row.closing_time),
    business_day_cutoff: text(row.business_day_cutoff) ?? '04:00',
    province_code: text(row.province_code),
    ward_code: text(row.ward_code),
    province_name: text(row.province_name),
    ward_name: text(row.ward_name),
    street: text(row.street),
    description: text(row.description),
    logo_url: text(row.logo_url),
    profile_key: text(row.profile_key),
    profile_keys: keys,
    interests: Array.isArray(row.interests)
      ? row.interests.filter((key): key is string => typeof key === 'string')
      : [],
    filled: typeof row.filled === 'number' ? row.filled : 0,
    filled_total: typeof row.filled_total === 'number' ? row.filled_total : 11,
    open_shifts: typeof row.open_shifts === 'number' ? row.open_shifts : 0,
    fallback: {
      name: text(fallback.name),
      phone: text(fallback.phone),
      contact_email: text(fallback.contact_email),
      address: text(fallback.address),
      logo_url: text(fallback.logo_url),
    },
  }
}

export function useStoreInfo(storeId: string | null, enabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'store-info', storeId),
    enabled: enabled && snapshot.status === 'authenticated' && Boolean(storeId),
    queryFn: async () =>
      normalizeStoreInfo((await posRequest<{ data?: unknown }>('GET', '/pos/store_info')).data),
  })
}

export function saveStoreInfo(body: Record<string, unknown>) {
  return posRequest<{ data?: unknown }>('PATCH', '/pos/store_info', { body })
}

export function uploadStoreLogo(body: { data: string; filename: string; content_type: string }) {
  return posRequest<{ data?: unknown }>('POST', '/pos/store_info/logo', { body })
}

export function clearStoreLogo() {
  return posRequest<{ data?: unknown }>('DELETE', '/pos/store_info/logo')
}

export type DangerZoneBranch = {
  id: string
  name: string
  code: string
  status: string
  is_default: boolean
}

export function useStoreBranches(storeId: string | null, enabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'store-info-branches', storeId),
    enabled: enabled && snapshot.status === 'authenticated' && Boolean(storeId),
    queryFn: async () => {
      const response = await posRequest<{ data?: unknown[] }>('GET', '/pos/branches', {
        params: { per_page: '100' },
      })
      const rows = Array.isArray(response.data) ? response.data : []
      return rows.flatMap((row) => {
        const item = row as Record<string, unknown>
        if (typeof item.id !== 'string' || typeof item.name !== 'string') return []
        return [
          {
            id: item.id,
            name: item.name,
            code: typeof item.code === 'string' ? item.code : '',
            status: typeof item.status === 'string' ? item.status : 'active',
            is_default: item.is_default === true,
          } satisfies DangerZoneBranch,
        ]
      })
    },
  })
}

export type ResetDataResult = {
  scope: 'store' | 'branch'
  branch_id: string | null
  branch_name: string | null
  deleted_counts: {
    transactions: number
    catalog: number
    total: number
  }
  preserved_staff: boolean
}

export async function resetStoreOrBranchData(body: {
  scope: 'store' | 'branch'
  branch_id?: string | null
  wipe_transactions: boolean
  wipe_catalog: boolean
  confirmation: string
}) {
  const res = await posRequest<{ data: ResetDataResult }>('POST', '/pos/store_info/reset_data', {
    body,
  })
  return res.data
}

export type DeleteBranchResult = {
  deleted_branch_id: string
  deleted_branch_name: string
  remaining_branches_count: number
}

export async function deleteStoreBranch(body: { branch_id: string; confirmation: string }) {
  const res = await posRequest<{ data: DeleteBranchResult }>(
    'POST',
    '/pos/store_info/delete_branch',
    { body },
  )
  return res.data
}

export type DeleteStoreResult = {
  deleted_store_id: string
  deleted_store_name: string
  next_store_id: string
}

export async function deleteCurrentStore(body: { confirmation: string }) {
  const res = await posRequest<{ data: DeleteStoreResult }>(
    'POST',
    '/pos/store_info/delete_store',
    { body },
  )
  return res.data
}

export function useBranchInfo(branchId: string | null, enabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'branch-info', branchId),
    enabled: enabled && snapshot.status === 'authenticated' && Boolean(branchId),
    queryFn: async () =>
      (await posRequest<{ data?: unknown }>('GET', `/pos/branches/${branchId}/info`)).data,
  })
}

export function saveBranchInfo(branchId: string, body: Record<string, unknown>) {
  return posRequest<{ data?: unknown }>('PATCH', `/pos/branches/${branchId}/info`, { body })
}

export function uploadBranchLogo(branchId: string, file: File) {
  const form = new FormData()
  form.append('logo', file)
  return posRequest<{ data?: unknown }>('POST', `/pos/branches/${branchId}/info/logo`, {
    body: form,
  })
}

export function clearBranchLogo(branchId: string) {
  return posRequest<{ data?: unknown }>('DELETE', `/pos/branches/${branchId}/info/logo`)
}

export type AdminUnit = { code: string; name: string; kind: string }

export function useProvinces(enabled: boolean) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'admin-units', 'provinces'),
    enabled: enabled && snapshot.status === 'authenticated',
    staleTime: 86_400_000,
    queryFn: async () => {
      const data = (await posRequest<{ data?: { provinces?: unknown } }>('GET', '/pos/admin_units'))
        .data
      const rows = Array.isArray(data?.provinces) ? data.provinces : []
      return rows.flatMap((row) => {
        const item = row as { code?: unknown; name?: unknown; kind?: unknown }
        return typeof item.code === 'string' && typeof item.name === 'string'
          ? [
              {
                code: item.code,
                name: item.name,
                kind: typeof item.kind === 'string' ? item.kind : 'tinh',
              },
            ]
          : []
      })
    },
  })
}

export function useWards(province: string | null) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'admin-units', province),
    enabled: snapshot.status === 'authenticated' && Boolean(province),
    staleTime: 86_400_000,
    queryFn: async () => {
      const data = (
        await posRequest<{ data?: { wards?: unknown } }>('GET', '/pos/admin_units', {
          params: { province: province ?? undefined },
        })
      ).data
      const rows = Array.isArray(data?.wards) ? data.wards : []
      return rows.flatMap((row) => {
        const item = row as { code?: unknown; name?: unknown; kind?: unknown }
        return typeof item.code === 'string' && typeof item.name === 'string'
          ? [
              {
                code: item.code,
                name: item.name,
                kind: typeof item.kind === 'string' ? item.kind : 'xa_phuong',
              },
            ]
          : []
      })
    },
  })
}
