import type {
  PosFundAccount,
  PosFundVoucher,
  PosFundVoucherSummary,
  PosQuickQrResult,
} from '@shared/types/pos-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest as request } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { type Page, pageParams } from '../lib/table-params'
import { useSession } from './use-session'

async function write<T>(method: 'POST' | 'PATCH', path: string, body: Record<string, unknown>) {
  const key = crypto.randomUUID()
  const result = await request<{ data: T }>(method, path, {
    body: { ...body, idempotency_key: key },
    idempotencyKey: key,
  })
  return result.data
}

export type FundAccountsResponse = {
  data: PosFundAccount[]
  meta: { count: number; total_balance: string; currency: string }
}

export function useFundAccounts(branchId: string | null) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'fund-accounts', branchId),
    enabled: status === 'authenticated' && Boolean(branchId),
    queryFn: () =>
      request<FundAccountsResponse>('GET', '/pos/fund_accounts', {
        params: { branch_id: branchId ?? undefined },
      }),
    staleTime: 5_000,
  })
}

export function useCreateFundAccount() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      branchId: string
      name: string
      kind: 'cash' | 'bank' | 'ewallet'
      bankName?: string
      accountNumber?: string
      openingBalance?: string
    }) =>
      write<PosFundAccount>('POST', '/pos/fund_accounts', {
        branch_id: input.branchId,
        name: input.name,
        kind: input.kind,
        bank_name: input.bankName || undefined,
        account_number: input.accountNumber || undefined,
        opening_balance: input.openingBalance || '0',
      }),
    onSettled: () => client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-accounts'] }),
  })
}

export function useUpdateFundAccount() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      accountId: string
      name?: string
      bankName?: string
      accountNumber?: string
      openingBalance?: string
      status?: 'active' | 'archived'
    }) =>
      write<PosFundAccount>('PATCH', `/pos/fund_accounts/${input.accountId}`, {
        name: input.name,
        bank_name: input.bankName,
        account_number: input.accountNumber,
        opening_balance: input.openingBalance,
        status: input.status,
      }),
    onSettled: () => client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-accounts'] }),
  })
}

export function useTransferFunds() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      branchId: string
      fromAccountId: string
      toAccountId: string
      amount: string
      occurredAt?: string
      reference?: string
      note?: string
    }) =>
      write<PosFundVoucher>('POST', '/pos/fund_accounts/transfer', {
        branch_id: input.branchId,
        from_account_id: input.fromAccountId,
        to_account_id: input.toAccountId,
        amount: input.amount,
        occurred_at: input.occurredAt || undefined,
        reference: input.reference || undefined,
        note: input.note || undefined,
      }),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-accounts'] }),
        client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-vouchers'] }),
      ]),
  })
}

export type FundVoucherFilters = {
  kind?: string
  fundAccountId?: string
  status?: string
  categoryCode?: string
  from?: string
  to?: string
  search?: string
}

export type FundVoucherPage = Page<PosFundVoucher> & {
  meta: Page<PosFundVoucher>['meta'] & { summary?: PosFundVoucherSummary }
}

export function fetchFundVouchers(
  branchId: string,
  filters: FundVoucherFilters,
  params: Record<string, unknown>,
) {
  return request<FundVoucherPage>('GET', '/pos/fund_vouchers', {
    params: {
      branch_id: branchId,
      kind: filters.kind || undefined,
      fund_account_id: filters.fundAccountId || undefined,
      status: filters.status || undefined,
      category_code: filters.categoryCode || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      search: filters.search || undefined,
      ...pageParams(params),
    },
  })
}

export function useCreateFundVoucher() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      branchId: string
      kind: 'income' | 'expense'
      fundAccountId: string
      amount: string
      categoryCode: string
      categoryLabel?: string
      taxDeductible?: boolean
      counterpartyName?: string
      reference?: string
      note?: string
      occurredAt?: string
    }) =>
      write<PosFundVoucher>('POST', '/pos/fund_vouchers', {
        branch_id: input.branchId,
        kind: input.kind,
        fund_account_id: input.fundAccountId,
        amount: input.amount,
        category_code: input.categoryCode,
        category_label: input.categoryLabel || undefined,
        tax_deductible: input.taxDeductible ?? true,
        counterparty_name: input.counterpartyName || undefined,
        reference: input.reference || undefined,
        note: input.note || undefined,
        occurred_at: input.occurredAt || undefined,
      }),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-vouchers'] }),
        client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-accounts'] }),
      ]),
  })
}

export function useVoidFundVoucher() {
  const { storeId } = useSession()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { voucherId: string; reason: string }) =>
      write<PosFundVoucher>('POST', `/pos/fund_vouchers/${input.voucherId}/void`, {
        reason: input.reason,
      }),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-vouchers'] }),
        client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-accounts'] }),
      ]),
  })
}

export function useQuickQr() {
  return useMutation({
    mutationFn: (input: { branchId: string; amount?: string; reference?: string }) =>
      request<{ data: PosQuickQrResult }>('POST', '/pos/fund_vouchers/quick_qr', {
        body: {
          branch_id: input.branchId,
          amount: input.amount || undefined,
          reference: input.reference || undefined,
        },
      }).then((res) => res.data),
  })
}
