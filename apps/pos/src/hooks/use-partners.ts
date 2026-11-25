import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest as request } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'
import type { StockDocument } from './use-stock'

export type PartnerGroup = {
  id: string
  kind: 'customer' | 'supplier'
  name: string
  note?: string | null
  members_count?: number
  created_at?: string
}

export type PosSupplier = {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  partner_group_id: string | null
  partner_group_name: string | null
  tax_code: string | null
  invoice_company: string | null
  invoice_address: string | null
  bank_name: string | null
  bank_account: string | null
  tags: string[]
  status: 'active' | 'inactive'
  opening_payable: string
  also_customer: boolean
  note: string | null
  import_count: number
  imported_total: string
  paid_total: string
  payable_balance: string
  created_at: string
}

export type SupplierPayment = {
  id: string
  supplier_id: string
  branch_id: string
  stock_document_id: string | null
  stock_document_code: string | null
  amount: string
  payment_method: 'cash' | 'bank' | 'ewallet'
  occurred_at: string
  actor_name: string | null
  note: string | null
}

export type SupplierDetail = PosSupplier & {
  imports: StockDocument[]
  payments: SupplierPayment[]
}

export type SuppliersResponse = {
  data: PosSupplier[]
  meta: {
    summary: {
      total_suppliers: number
      total_imports: number
      total_imported_value: string
      total_payable: string
    }
    total: number
  }
}

export type PartnerCustomer = {
  id: string
  code: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  partner_group_id: string | null
  partner_group_name: string | null
  tags: string[]
  status: 'active' | 'inactive'
  tax_code: string | null
  invoice_company: string | null
  invoice_address: string | null
  gender: string | null
  birthday: string | null
  also_supplier: boolean
  note: string | null
  receivable_balance: string
  created_at: string
}

export type PartnerCustomerDetail = PartnerCustomer & {
  recent_receivables: {
    id: string
    kind: string
    amount: string
    occurred_at: string | null
    note: string | null
  }[]
}

export type PartnerCustomersResponse = {
  data: PartnerCustomer[]
  meta: {
    summary: {
      total_customers: number
      active_count: number
      total_receivable: string
      debtors_count: number
    }
    total: number
  }
}

async function write<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
) {
  const key = crypto.randomUUID()
  const result = await request<{ data: T }>(method, path, {
    body: body ? { ...body, idempotency_key: key } : undefined,
    idempotencyKey: key,
  })
  return result?.data
}

export function usePartnerGroups(kind: 'customer' | 'supplier') {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'partner-groups', kind),
    enabled: status === 'authenticated',
    queryFn: () => request<{ data: PartnerGroup[] }>('GET', '/pos/partner_groups', { params: { kind } }),
    select: (res) => res.data,
    staleTime: 10_000,
  })
}

export function useCreatePartnerGroup(kind: 'customer' | 'supplier') {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; note?: string }) =>
      write<PartnerGroup>('POST', '/pos/partner_groups', { ...payload, kind }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'partner-groups', kind) })
    },
  })
}

export function useDeletePartnerGroup(kind: 'customer' | 'supplier') {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => write<void>('DELETE', `/pos/partner_groups/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'partner-groups', kind) })
    },
  })
}

export function useSuppliers(
  filters: { q?: string; status?: string; partner_group_id?: string; debt_filter?: string; sort?: string } = {},
) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'suppliers', filters),
    enabled: status === 'authenticated',
    queryFn: () => request<SuppliersResponse>('GET', '/pos/suppliers', { params: filters }),
    staleTime: 5_000,
  })
}

export function useSupplierDetail(id: string | null) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'supplier', id),
    enabled: status === 'authenticated' && Boolean(id),
    queryFn: () => request<{ data: SupplierDetail }>('GET', `/pos/suppliers/${id}`),
    select: (res) => res.data,
  })
}

export function useCreateSupplier() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => write<PosSupplier>('POST', '/pos/suppliers', payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'suppliers') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'partner-groups', 'supplier') })
    },
  })
}

export function useUpdateSupplier() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      write<PosSupplier>('PATCH', `/pos/suppliers/${id}`, payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'suppliers') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'supplier') })
    },
  })
}

export function useRecordSupplierPayment() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      supplierId,
      branch_id,
      amount,
      payment_method,
      stock_document_id,
      note,
    }: {
      supplierId: string
      branch_id: string
      amount: string
      payment_method?: string
      stock_document_id?: string
      note?: string
    }) =>
      write<SupplierPayment>('POST', `/pos/suppliers/${supplierId}/payments`, {
        branch_id,
        amount,
        payment_method,
        stock_document_id,
        note,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'suppliers') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'supplier') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-documents') })
    },
  })
}

export function usePartnerCustomers(
  filters: { q?: string; status?: string; partner_group_id?: string; debt_filter?: string; sort?: string } = {},
) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'partner-customers', filters),
    enabled: status === 'authenticated',
    queryFn: () => request<PartnerCustomersResponse>('GET', '/pos/partner_customers', { params: filters }),
    staleTime: 5_000,
  })
}

export function usePartnerCustomerDetail(id: string | null) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'partner-customer', id),
    enabled: status === 'authenticated' && Boolean(id),
    queryFn: () => request<{ data: PartnerCustomerDetail }>('GET', `/pos/partner_customers/${id}`),
    select: (res) => res.data,
  })
}

export function useCreatePartnerCustomer() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      write<PartnerCustomer>('POST', '/pos/partner_customers', payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'partner-customers') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'partner-groups', 'customer') })
    },
  })
}

export function useUpdatePartnerCustomer() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      write<PartnerCustomer>('PATCH', `/pos/partner_customers/${id}`, payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'partner-customers') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'partner-customer') })
    },
  })
}
