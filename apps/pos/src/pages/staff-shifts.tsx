import { formatMoney } from '@shared/money'
import { describeFailure } from '@shared/request-failure'
import { PageHeader } from '@spree/dashboard-core'
import {
  ActiveBadge,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@spree/dashboard-ui'
import { CalculatorIcon, EyeIcon, ShieldAlertIcon } from '@spree/dashboard-ui/icons'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import { presetRange, ReportDateBar } from '../components/reports/analytics-ui'
import { ModelCard } from '../components/setup/model-ui'
import { type StaffShiftRow, useStaffShifts } from '../hooks/use-payroll'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import { useStaffDirectory } from '../hooks/use-staff-directory'
import { useBranches } from '../hooks/use-topology'

const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring'

const VND_DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000]

function formatDuration(minutes: number) {
  if (minutes <= 0) return '0p'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days} ngày`)
  if (hours > 0) parts.push(`${hours}g`)
  if (mins > 0 || parts.length === 0) parts.push(`${mins}p`)
  return parts.join(' ')
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

// Vietnamese number-to-words helper for cash counting verification (Tendoo-inspired)
function numberToVietnameseWords(amount: number): string {
  const n = Math.round(Math.abs(amount))
  if (n === 0) return 'Không đồng'
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const units = ['', 'nghìn', 'triệu', 'tỷ']
  const readTriple = (num: number, full: boolean) => {
    const h = Math.floor(num / 100)
    const t = Math.floor((num % 100) / 10)
    const u = num % 10
    const out: string[] = []
    if (h > 0 || full) out.push(`${digits[h]} trăm`)
    if (t === 0 && u > 0 && (h > 0 || full)) out.push('linh')
    else if (t === 1) out.push('mười')
    else if (t > 1) out.push(`${digits[t]} mươi`)
    if (u > 0) {
      if (u === 1 && t > 1) out.push('mốt')
      else if (u === 5 && t >= 1) out.push('lăm')
      else out.push(digits[u])
    }
    return out.join(' ')
  }
  const groups: number[] = []
  let rem = n
  while (rem > 0) {
    groups.push(rem % 1000)
    rem = Math.floor(rem / 1000)
  }
  const words: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    const full = i < groups.length - 1
    words.push(`${readTriple(groups[i], full)}${units[i] ? ` ${units[i]}` : ''}`)
  }
  const sentence = `${amount < 0 ? 'Âm ' : ''}${words.join(' ')} đồng`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

export function StaffShiftsPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const access = context.data?.administration ?? { read: false, write: false }
  const canRead = access.read || (context.data?.capabilities.length ?? 0) > 0

  const [range, setRange] = useState(() => presetRange('last30'))
  const [branchId, setBranchId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [status, setStatus] = useState('')
  const [selectedShift, setSelectedShift] = useState<StaffShiftRow | null>(null)
  const [showCalculator, setShowCalculator] = useState(false)

  const shiftsQuery = useStaffShifts(
    { from: range.from, to: range.to, branch_id: branchId, staff_id: staffId, status },
    canRead,
  )
  const branchesQuery = useBranches(access.read)
  const staffQuery = useStaffDirectory({ limit: 100 }, access.read)

  const shifts = shiftsQuery.data?.data ?? []
  const summary = shiftsQuery.data?.meta.summary ?? { total: 0, open: 0, closed: 0 }
  const branches = branchesQuery.data?.data ?? []
  const staffList = staffQuery.data?.data ?? []

  if (context.isPending) return <PageSkeleton />

  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('staffShifts.title')} />
        <ModelCard title={t('forbidden')} id="staff-shifts-forbidden" icon={<ShieldAlertIcon />}>
          <p>{t('adminAccessDenied')}</p>
        </ModelCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffShifts.title')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowCalculator(true)}>
              <CalculatorIcon className="mr-1.5 size-4" />
              {t('staffShifts.cashCalculator')}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/$storeId/shifts" params={{ storeId }}>
                {t('staffShifts.openDrawerControl')}
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            {t('staffShifts.kpiTotal')}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{summary.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            {t('staffShifts.kpiOpen')}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
            {summary.open}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            {t('staffShifts.kpiClosed')}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{summary.closed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <ReportDateBar from={range.from} to={range.to} onChange={setRange} />
        <div className="flex flex-wrap items-center gap-3">
          {branches.length > 0 && (
            <select
              aria-label={t('branch')}
              className={`${selectClass} w-full sm:w-52`}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">{t('staffDirectory.allBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {staffList.length > 0 && (
            <select
              aria-label={t('adminStaff')}
              className={`${selectClass} w-full sm:w-56`}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">{t('staffShifts.allStaff')}</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label={t('adminStatus')}
            className={`${selectClass} w-full sm:w-44`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t('staffDirectory.allStatuses')}</option>
            <option value="open">{t('staffShifts.statusOpen')}</option>
            <option value="closed">{t('staffShifts.statusClosed')}</option>
          </select>
        </div>
      </div>

      {shiftsQuery.isError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {describeFailure(shiftsQuery.error, t)}
        </div>
      )}

      {/* Shifts Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">{t('adminStatus')}</th>
              <th className="px-4 py-3">{t('staffShifts.workTime')}</th>
              <th className="px-4 py-3">{t('adminStaff')}</th>
              <th className="px-4 py-3">{t('branch')}</th>
              <th className="px-4 py-3 text-right">{t('staffShifts.expectedCash')}</th>
              <th className="px-4 py-3 text-right">{t('staffShifts.countedCash')}</th>
              <th className="px-4 py-3 text-right">{t('staffShifts.variance')}</th>
              <th className="w-20 px-4 py-3 text-right">{t('staffDirectory.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shiftsQuery.isPending ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {t('waiting')}
                </td>
              </tr>
            ) : shifts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  {t('staffShifts.empty')}
                </td>
              </tr>
            ) : (
              shifts.map((shift) => {
                const varianceNum = shift.variance ? Number(shift.variance) : 0
                return (
                  <tr key={shift.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <ActiveBadge
                        active={shift.status === 'open'}
                        activeLabel={t('staffShifts.statusOpen')}
                        inactiveLabel={t('staffShifts.statusClosed')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium tabular-nums">
                        {formatDateTime(shift.opened_at)}
                        {' — '}
                        {shift.closed_at ? formatDateTime(shift.closed_at) : t('staffShifts.now')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDuration(shift.duration_minutes)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{shift.staff_name}</div>
                      <div className="text-xs text-muted-foreground">{shift.staff_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{shift.branch_name}</div>
                      {shift.register_name && (
                        <div className="text-xs text-muted-foreground">{shift.register_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(shift.expected_cash, shift.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {shift.counted_cash !== null
                        ? formatMoney(shift.counted_cash, shift.currency)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {shift.variance !== null ? (
                        <span
                          className={
                            varianceNum < 0
                              ? 'font-medium text-destructive'
                              : varianceNum > 0
                                ? 'font-medium text-emerald-600'
                                : 'text-muted-foreground'
                          }
                        >
                          {formatMoney(shift.variance, shift.currency)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedShift(shift)}
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Shift Detail Modal */}
      {selectedShift && (
        <Dialog open onOpenChange={(open) => !open && setSelectedShift(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('staffShifts.detailTitle')}</DialogTitle>
              <DialogDescription>
                {selectedShift.staff_name} · {selectedShift.branch_name}
                {selectedShift.register_name ? ` · ${selectedShift.register_name}` : ''}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{t('staffShifts.openedAt')}</div>
                  <div className="mt-0.5 font-medium tabular-nums">
                    {formatDateTime(selectedShift.opened_at)}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{t('staffShifts.closedAt')}</div>
                  <div className="mt-0.5 font-medium tabular-nums">
                    {selectedShift.closed_at
                      ? formatDateTime(selectedShift.closed_at)
                      : t('staffShifts.statusOpen')}
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border p-3.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('staffShifts.openingFloat')}</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(selectedShift.opening_float, selectedShift.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('staffShifts.inflow')}</span>
                  <span className="font-medium tabular-nums text-emerald-600">
                    +{formatMoney(selectedShift.inflow_total, selectedShift.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('staffShifts.outflow')}</span>
                  <span className="font-medium tabular-nums text-destructive">
                    -{formatMoney(selectedShift.outflow_total, selectedShift.currency)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>{t('staffShifts.expectedCash')}</span>
                  <span className="tabular-nums">
                    {formatMoney(selectedShift.expected_cash, selectedShift.currency)}
                  </span>
                </div>
                {selectedShift.counted_cash !== null && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('staffShifts.countedCash')}</span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(selectedShift.counted_cash, selectedShift.currency)}
                      </span>
                    </div>
                    <div className="text-xs italic text-muted-foreground text-right">
                      {numberToVietnameseWords(Number(selectedShift.counted_cash))}
                    </div>
                  </>
                )}
                {selectedShift.variance !== null && (
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">{t('staffShifts.variance')}</span>
                    <Badge
                      variant={Number(selectedShift.variance) === 0 ? 'secondary' : 'destructive'}
                    >
                      {formatMoney(selectedShift.variance, selectedShift.currency)}
                    </Badge>
                  </div>
                )}
              </div>

              {selectedShift.reason && (
                <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{t('staffShifts.note')}: </span>
                  {selectedShift.reason}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedShift(null)}>
                {t('staffDirectory.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Denomination Cash Calculator Modal (Tendoo-inspired) */}
      {showCalculator && <CashCalculatorDialog onClose={() => setShowCalculator(false)} />}
    </div>
  )
}

function CashCalculatorDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [counts, setCounts] = useState<Record<number, number>>({})

  const total = VND_DENOMINATIONS.reduce((sum, denom) => sum + denom * (counts[denom] || 0), 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('staffShifts.cashCalculator')}</DialogTitle>
          <DialogDescription>{t('staffShifts.cashCalculatorHint')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {VND_DENOMINATIONS.map((denom) => {
              const qty = counts[denom] || 0
              return (
                <div key={denom} className="grid grid-cols-3 items-center gap-2 text-sm">
                  <span className="font-medium tabular-nums">
                    {denom.toLocaleString('vi-VN')} đ
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-right tabular-nums"
                    value={qty === 0 ? '' : String(qty)}
                    placeholder="0"
                    onChange={(e) => {
                      const val = Math.max(0, Number.parseInt(e.target.value || '0', 10) || 0)
                      setCounts((prev) => ({ ...prev, [denom]: val }))
                    }}
                  />
                  <span className="text-right text-muted-foreground tabular-nums">
                    {(denom * qty).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              )
            })}
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-base font-semibold">
              <span>{t('staffShifts.calculatorTotal')}</span>
              <span className="tabular-nums text-primary">{total.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="mt-1 text-xs italic text-muted-foreground">
              {numberToVietnameseWords(total)}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setCounts({})}>
            {t('staffShifts.resetCalculator')}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('staffDirectory.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
