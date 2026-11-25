import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

export type PayrollLine = {
  id?: string
  staff_id: string
  staff?: { id: string; email: string; full_name: string | null }
  position?: number
  piece_quantity: string
  piece_amount: string
  work_days: string
  time_amount: string
  paid_leave_days: string
  paid_leave_amount: string
  payroll_allowance: string
  other_allowance: string
  bonus: string
  gross_amount: string
  employee_bhxh: string
  employee_bhyt: string
  employee_bhtn: string
  other_deduction: string
  pit_tax: string
  total_deductions: string
  net_amount: string
  employer_bhxh: string
  employer_bhyt: string
  employer_bhtn: string
  note: string | null
}

export type PayrollSummary = {
  id: string
  code: string
  name: string
  period_label: string | null
  period_start: string
  period_end: string
  payroll_date: string
  status: 'draft' | 'finalized'
  note: string | null
  branch_id: string | null
  branch_name: string | null
  line_count: number
  total_gross: string
  total_deductions: string
  total_net: string
  total_pit: string
  total_bhxh: string
  total_bhyt: string
  total_bhtn: string
  total_employer_cost: string
  finalized_at: string | null
  created_at: string | null
  updated_at: string | null
  lines?: PayrollLine[]
}

export type PayrollListResponse = {
  data: PayrollSummary[]
  meta: {
    page: number
    limit: number
    count: number
    pages: number
    next: number | null
    next_code: string
  }
}

export type StaffShiftRow = {
  id: string
  status: 'open' | 'closed'
  business_date: string | null
  opened_at: string | null
  closed_at: string | null
  duration_minutes: number
  currency: string
  opening_float: string
  branch_id: string
  branch_name: string
  register_id: string | null
  register_name: string | null
  staff_id: string
  staff_name: string
  staff_email: string
  expected_cash: string
  counted_cash: string | null
  variance: string | null
  inflow_total: string
  outflow_total: string
  reason: string | null
  breakdown: Record<string, unknown>
}

export type StaffShiftsResponse = {
  data: StaffShiftRow[]
  meta: {
    page: number
    limit: number
    count: number
    pages: number
    next: number | null
    summary: { total: number; open: number; closed: number }
  }
}

export function usePayrolls(
  params: { q?: string; status?: string; branch_id?: string },
  enabled = true,
) {
  const snapshot = useSession()
  const queryParams = {
    q: params.q || undefined,
    status: params.status || undefined,
    branch_id: params.branch_id || undefined,
    limit: '100',
  }
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'payrolls', queryParams),
    enabled: enabled && snapshot.status === 'authenticated',
    queryFn: () =>
      posRequest<PayrollListResponse>('GET', '/pos/payrolls', { params: queryParams }),
  })
}

export function usePayrollDetail(payrollId: string, enabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'payroll', payrollId),
    enabled: enabled && Boolean(payrollId) && snapshot.status === 'authenticated',
    queryFn: () => posRequest<{ data: PayrollSummary }>('GET', `/pos/payrolls/${payrollId}`),
  })
}

export function usePayrollMutation() {
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
    }) => posRequest<{ data?: PayrollSummary }>(method, path, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'pos' &&
          query.queryKey[1] === storeId &&
          (query.queryKey[2] === 'payrolls' || query.queryKey[2] === 'payroll'),
      })
    },
  })
}

export function useStaffShifts(
  params: { from?: string; to?: string; branch_id?: string; staff_id?: string; status?: string },
  enabled = true,
) {
  const snapshot = useSession()
  const queryParams = {
    from: params.from || undefined,
    to: params.to || undefined,
    branch_id: params.branch_id || undefined,
    staff_id: params.staff_id || undefined,
    status: params.status || undefined,
    limit: '100',
  }
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'staff-shifts', queryParams),
    enabled: enabled && snapshot.status === 'authenticated',
    queryFn: () =>
      posRequest<StaffShiftsResponse>('GET', '/pos/staff_shifts', { params: queryParams }),
  })
}
