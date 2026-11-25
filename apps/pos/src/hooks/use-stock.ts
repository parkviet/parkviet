import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest as request } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

export type StockOverviewItem = {
  variant_id: string
  product_id: string
  sku: string | null
  name: string
  options_text: string | null
  item_kind: 'product' | 'ingredient'
  base_unit: string
  track_inventory: boolean
  cost_price: string
  on_hand: number
  stock_value: string
  min_quantity: number | null
  stock_status: 'in_stock' | 'low' | 'out_of_stock'
}

export type StockOverviewResponse = {
  data: StockOverviewItem[]
  meta: {
    summary: {
      total_items: number
      total_quantity: number
      total_value: string
      tracked_count: number
      untracked_count: number
      low_count: number
      out_of_stock_count: number
    }
    total: number
  }
}

export type StockLedgerRow = {
  id: string
  occurred_at: string
  variant_id: string | null
  sku: string | null
  name: string
  item_kind: 'product' | 'ingredient'
  base_unit: string
  movement_kind: string
  quantity: number
  unit_cost: string
  value: string
  reference_code: string | null
  reason: string | null
}

export type StockLedgerResponse = {
  data: StockLedgerRow[]
  meta: {
    summary: {
      opening_qty: number
      inflow_qty: number
      outflow_qty: number
      closing_qty: number
      opening_value: string
      inflow_value: string
      outflow_value: string
      closing_value: string
    }
    total: number
  }
}

export type StockDocumentKind = 'import' | 'export' | 'count' | 'opening'
export type StockDocumentStatus = 'draft' | 'completed' | 'canceled'

export type StockDocumentLine = {
  id: string
  variant_id: string
  sku: string | null
  name: string
  options_text: string | null
  base_unit: string
  item_kind: 'product' | 'ingredient'
  quantity: number
  system_quantity: number | null
  actual_quantity: number | null
  unit_cost: string
  line_total: string
  note: string | null
}

export type StockDocument = {
  id: string
  code: string
  kind: StockDocumentKind
  status: StockDocumentStatus
  branch_id: string
  supplier_id: string | null
  supplier_name: string | null
  customer_id: string | null
  counterparty_name: string | null
  invoice_type: string | null
  invoice_number: string | null
  export_reason: string | null
  occurred_at: string
  subtotal: string
  discount_amount: string
  extra_cost: string
  tax_rate: string
  tax_amount: string
  total_amount: string
  paid_amount: string
  payment_status: 'unpaid' | 'partial' | 'paid'
  note: string | null
  actor_name: string | null
  completed_at: string | null
  canceled_at: string | null
  cancel_reason: string | null
  items_count: number
  total_quantity: number
  variance_quantity: number | null
  created_at: string
  lines?: StockDocumentLine[]
}

export type StockDocumentsResponse = {
  data: StockDocument[]
  meta: { total: number; total_amount: string }
}

async function write<T>(method: 'POST' | 'PATCH', path: string, body: Record<string, unknown>) {
  const key = crypto.randomUUID()
  const result = await request<{ data: T }>(method, path, {
    body: { ...body, idempotency_key: key },
    idempotencyKey: key,
  })
  return result.data
}

export function useStockOverview(
  branchId: string | null,
  filters: {
    q?: string
    item_kind?: string
    stock_status?: string
    tracked?: string
  } = {},
) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'stock-overview', branchId, filters),
    enabled: status === 'authenticated' && Boolean(branchId),
    queryFn: () =>
      request<StockOverviewResponse>('GET', '/pos/stock/overview', {
        params: { branch_id: branchId ?? undefined, ...filters },
      }),
    staleTime: 5_000,
  })
}

export function useStockLedger(
  branchId: string | null,
  filters: {
    from?: string
    to?: string
    q?: string
    item_kind?: string
    movement_kind?: string
  } = {},
) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'stock-ledger', branchId, filters),
    enabled: status === 'authenticated' && Boolean(branchId),
    queryFn: () =>
      request<StockLedgerResponse>('GET', '/pos/stock/ledger', {
        params: { branch_id: branchId ?? undefined, ...filters },
      }),
    staleTime: 5_000,
  })
}

export function useStockDocuments(
  branchId: string | null,
  filters: {
    kind: StockDocumentKind
    status?: string
    payment_status?: string
    supplier_id?: string
    q?: string
    from?: string
    to?: string
  },
) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'stock-documents', branchId, filters),
    enabled: status === 'authenticated' && Boolean(branchId),
    queryFn: () =>
      request<StockDocumentsResponse>('GET', '/pos/stock/documents', {
        params: { branch_id: branchId ?? undefined, ...filters },
      }),
    staleTime: 5_000,
  })
}

export function useStockDocument(id: string | null) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'stock-document', id),
    enabled: status === 'authenticated' && Boolean(id),
    queryFn: () => request<{ data: StockDocument }>('GET', `/pos/stock/documents/${id}`),
    select: (res) => res.data,
  })
}

export function useCreateStockDocument() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      write<StockDocument>('POST', '/pos/stock/documents', payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-documents') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-overview') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-ledger') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'suppliers') })
    },
  })
}

export function useCompleteStockDocument() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => write<StockDocument>('POST', `/pos/stock/documents/${id}/complete`, {}),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-documents') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-document') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-overview') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-ledger') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'suppliers') })
    },
  })
}

export function useCancelStockDocument() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      write<StockDocument>('POST', `/pos/stock/documents/${id}/cancel`, { reason }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-documents') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-document') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-overview') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-ledger') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'suppliers') })
    },
  })
}

export function usePayStockDocument() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      amount,
      payment_method,
      note,
    }: {
      id: string
      amount: string
      payment_method?: string
      note?: string
    }) =>
      write<StockDocument>('POST', `/pos/stock/documents/${id}/pay`, {
        amount,
        payment_method,
        note,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-documents') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'stock-document') })
      void client.invalidateQueries({ queryKey: posKey(storeId, 'suppliers') })
    },
  })
}
