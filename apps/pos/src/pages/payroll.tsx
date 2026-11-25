import { formatMoney } from '@shared/money'
import { describeFailure } from '@shared/request-failure'
import { PageHeader } from '@spree/dashboard-core'
import {
  ActiveBadge,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RowActions,
  useConfirm,
} from '@spree/dashboard-ui'
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  TrashIcon,
} from '@spree/dashboard-ui/icons'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelCard } from '../components/setup/model-ui'
import {
  type PayrollLine,
  type PayrollSummary,
  usePayrollDetail,
  usePayrollMutation,
  usePayrolls,
} from '../hooks/use-payroll'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import { useStaffDirectory } from '../hooks/use-staff-directory'
import { useBranches } from '../hooks/use-topology'

const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring'

function num(value: string | number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function fmtVnd(value: string | number) {
  return formatMoney(String(Math.round(num(value))), 'VND')
}

function computeLine(line: PayrollLine): PayrollLine {
  const gross =
    num(line.piece_amount) +
    num(line.time_amount) +
    num(line.paid_leave_amount) +
    num(line.payroll_allowance) +
    num(line.other_allowance) +
    num(line.bonus)
  const deductions =
    num(line.employee_bhxh) +
    num(line.employee_bhyt) +
    num(line.employee_bhtn) +
    num(line.other_deduction) +
    num(line.pit_tax)
  const net = gross - deductions
  return {
    ...line,
    gross_amount: String(gross),
    total_deductions: String(deductions),
    net_amount: String(net),
  }
}

function blankLine(staff: { id: string; email: string; full_name: string | null }): PayrollLine {
  return {
    staff_id: staff.id,
    staff,
    piece_quantity: '0',
    piece_amount: '0',
    work_days: '0',
    time_amount: '0',
    paid_leave_days: '0',
    paid_leave_amount: '0',
    payroll_allowance: '0',
    other_allowance: '0',
    bonus: '0',
    gross_amount: '0',
    employee_bhxh: '0',
    employee_bhyt: '0',
    employee_bhtn: '0',
    other_deduction: '0',
    pit_tax: '0',
    total_deductions: '0',
    net_amount: '0',
    employer_bhxh: '0',
    employer_bhyt: '0',
    employer_bhtn: '0',
    note: '',
  }
}

function currentMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    label: `Tháng ${m + 1}/${y}`,
    name: `Bảng lương tháng ${m + 1}/${y}`,
    start: iso(first),
    end: iso(last),
    today: iso(now),
  }
}

export function PayrollListPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const access = context.data?.administration ?? { read: false, write: false }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)

  const payrollsQuery = usePayrolls(
    { q: search.trim(), status: statusFilter, branch_id: branchFilter },
    access.read,
  )
  const branchesQuery = useBranches(access.read)
  const staffQuery = useStaffDirectory({ limit: 100 }, access.read)
  const mutation = usePayrollMutation()

  const payrolls = payrollsQuery.data?.data ?? []
  const nextCode = payrollsQuery.data?.meta.next_code ?? 'BL0001'
  const branches = branchesQuery.data?.data ?? []
  const staffList = staffQuery.data?.data ?? []

  async function removePayroll(payroll: PayrollSummary) {
    if (!access.write || mutation.isPending) return
    const ok = await confirm({
      message: t('payroll.confirmDelete', { name: `${payroll.code} · ${payroll.name}` }),
      variant: 'destructive',
      confirmLabel: t('staffRoles.delete'),
      cancelLabel: t('adminCancel'),
    })
    if (!ok) return
    setNotice(null)
    try {
      await mutation.mutateAsync({ method: 'DELETE', path: `/pos/payrolls/${payroll.id}` })
      setNotice({ text: t('saved'), failed: false })
    } catch (err) {
      setNotice({ text: describeFailure(err, t), failed: true })
    }
  }

  if (context.isPending) return <PageSkeleton />

  if (!access.read) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('payroll.title')} />
        <ModelCard title={t('forbidden')} id="payroll-forbidden" icon={<ShieldAlertIcon />}>
          <p>{t('adminAccessDenied')}</p>
        </ModelCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('payroll.title')}
        actions={
          access.write ? (
            <Button onClick={() => setShowCreate(true)}>
              <PlusIcon className="mr-1.5 size-4" />
              {t('payroll.create')}
            </Button>
          ) : (
            <Badge variant="outline">{t('adminReadAccess')}</Badge>
          )
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Input
          type="search"
          className="w-full sm:w-64"
          placeholder={t('payroll.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={t('branch')}
          className={`${selectClass} w-full sm:w-52`}
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">{t('staffDirectory.allBranches')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t('adminStatus')}
          className={`${selectClass} w-full sm:w-44`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t('staffDirectory.allStatuses')}</option>
          <option value="draft">{t('payroll.statusDraft')}</option>
          <option value="finalized">{t('payroll.statusFinalized')}</option>
        </select>
      </div>

      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={`text-sm ${notice.failed ? 'text-destructive' : 'text-emerald-600'}`}
        >
          {notice.text}
        </p>
      )}

      {/* Payroll List Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">{t('payroll.date')}</th>
              <th className="px-4 py-3">{t('payroll.code')}</th>
              <th className="px-4 py-3">{t('payroll.name')}</th>
              <th className="px-4 py-3 text-right">{t('payroll.totalGross')}</th>
              <th className="px-4 py-3 text-right">{t('payroll.totalPit')}</th>
              <th className="px-4 py-3 text-right">BHXH</th>
              <th className="px-4 py-3 text-right">BHYT</th>
              <th className="px-4 py-3 text-right">BHTN</th>
              <th className="px-4 py-3 text-right">{t('payroll.totalNet')}</th>
              <th className="px-4 py-3">{t('adminStatus')}</th>
              <th className="w-20 px-4 py-3 text-right">{t('staffDirectory.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payrollsQuery.isPending ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                  {t('waiting')}
                </td>
              </tr>
            ) : payrolls.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  {t('payroll.empty')}
                </td>
              </tr>
            ) : (
              payrolls.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {item.payroll_date}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-medium">
                    <Link
                      to="/$storeId/payroll/$payrollId"
                      params={{ storeId, payrollId: item.id }}
                      className="text-primary hover:underline"
                    >
                      {item.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/$storeId/payroll/$payrollId"
                      params={{ storeId, payrollId: item.id }}
                      className="font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {item.period_start} → {item.period_end}
                      {item.branch_name ? ` · ${item.branch_name}` : ''}
                      {` · ${item.line_count} NV`}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {fmtVnd(item.total_gross)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {fmtVnd(item.total_pit)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {fmtVnd(item.total_bhxh)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {fmtVnd(item.total_bhyt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {fmtVnd(item.total_bhtn)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {fmtVnd(item.total_net)}
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge
                      active={item.status === 'finalized'}
                      activeLabel={t('payroll.statusFinalized')}
                      inactiveLabel={t('payroll.statusDraft')}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      actions={[
                        {
                          key: 'open',
                          label: t('payroll.openSheet'),
                          visible: true,
                          onSelect: () =>
                            void navigate({
                              to: '/$storeId/payroll/$payrollId',
                              params: { storeId, payrollId: item.id },
                            }),
                        },
                        {
                          key: 'delete',
                          label: t('staffRoles.delete'),
                          icon: <TrashIcon className="size-4" />,
                          visible: access.write,
                          destructive: true,
                          onSelect: () => void removePayroll(item),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && access.write && (
        <CreatePayrollDialog
          nextCode={nextCode}
          branches={branches}
          staffList={staffList}
          onCreated={(created) => {
            setShowCreate(false)
            void navigate({
              to: '/$storeId/payroll/$payrollId',
              params: { storeId, payrollId: created.id },
            })
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function CreatePayrollDialog({
  nextCode,
  branches,
  staffList,
  onCreated,
  onClose,
}: {
  nextCode: string
  branches: { id: string; name: string }[]
  staffList: {
    id: string
    email: string
    full_name: string | null
    status: string
    memberships: { branch_id: string; staff_role: { name: string } | null }[]
  }[]
  onCreated: (payroll: PayrollSummary) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutation = usePayrollMutation()
  const defaults = currentMonthRange()

  const [periodLabel, setPeriodLabel] = useState(defaults.label)
  const [periodStart, setPeriodStart] = useState(defaults.start)
  const [periodEnd, setPeriodEnd] = useState(defaults.end)
  const [name, setName] = useState(defaults.name)
  const [code, setCode] = useState(nextCode)
  const [payrollDate, setPayrollDate] = useState(defaults.today)
  const [branchId, setBranchId] = useState('')
  const [error, setError] = useState('')

  const activeStaff = staffList.filter(
    (s) =>
      s.status === 'active' &&
      (!branchId || s.memberships.some((m) => m.branch_id === branchId)),
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(() => activeStaff.map((s) => s.id))

  useEffect(() => {
    setSelectedIds(activeStaff.map((s) => s.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const allSelected =
    activeStaff.length > 0 && activeStaff.every((s) => selectedIds.includes(s.id))

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? activeStaff.map((s) => s.id) : [])
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await mutation.mutateAsync({
        method: 'POST',
        path: '/pos/payrolls',
        body: {
          code: code.trim(),
          name: name.trim(),
          period_label: periodLabel.trim(),
          period_start: periodStart,
          period_end: periodEnd,
          payroll_date: payrollDate,
          branch_id: branchId || null,
          staff_ids: selectedIds,
        },
      })
      if (res.data) onCreated(res.data)
    } catch (err) {
      setError(describeFailure(err, t))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('payroll.createTitle')}</DialogTitle>
          <DialogDescription>{t('payroll.createSubtitle')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-col">
          <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-period">{t('payroll.periodLabel')} *</Label>
                <Input
                  id="payroll-period"
                  required
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payroll-branch">{t('branch')}</Label>
                <select
                  id="payroll-branch"
                  className={`${selectClass} w-full`}
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
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-start">{t('payroll.periodStart')} *</Label>
                <Input
                  id="payroll-start"
                  type="date"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payroll-end">{t('payroll.periodEnd')} *</Label>
                <Input
                  id="payroll-end"
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payroll-name">{t('payroll.name')} *</Label>
              <Input
                id="payroll-name"
                required
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-code">{t('payroll.code')} *</Label>
                <Input
                  id="payroll-code"
                  required
                  maxLength={32}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payroll-date">{t('payroll.date')} *</Label>
                <Input
                  id="payroll-date"
                  type="date"
                  required
                  value={payrollDate}
                  onChange={(e) => setPayrollDate(e.target.value)}
                />
              </div>
            </div>

            {/* Staff selection table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('payroll.selectStaff', { count: selectedIds.length })}</Label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                  {t('payroll.selectAll')}
                </label>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2">{t('adminStaff')}</th>
                      <th className="px-3 py-2">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeStaff.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selectedIds.includes(s.id)}
                            onCheckedChange={(checked) => toggleOne(s.id, checked === true)}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{s.full_name || s.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t(mutation.isPending ? 'waiting' : 'payroll.createAndOpen')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PayrollDetailPage({ payrollId }: { payrollId: string }) {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const access = context.data?.administration ?? { read: false, write: false }

  const detailQuery = usePayrollDetail(payrollId, access.read)
  const staffQuery = useStaffDirectory({ limit: 100 }, access.read)
  const mutation = usePayrollMutation()

  const payroll = detailQuery.data?.data
  const allStaff = staffQuery.data?.data ?? []

  const [lines, setLines] = useState<PayrollLine[]>([])
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const [addStaffId, setAddStaffId] = useState('')

  useEffect(() => {
    if (payroll?.lines) {
      setLines(payroll.lines.map(computeLine))
      setDirty(false)
    }
  }, [payroll])

  const isLocked = payroll?.status === 'finalized' || !access.write
  const usedStaffIds = new Set(lines.map((l) => l.staff_id))
  const availableStaff = allStaff.filter((s) => s.status === 'active' && !usedStaffIds.has(s.id))

  function updateField(index: number, field: keyof PayrollLine, value: string) {
    setLines((prev) =>
      prev.map((row, idx) => (idx === index ? computeLine({ ...row, [field]: value }) : row)),
    )
    setDirty(true)
  }

  function addLine() {
    const target = availableStaff.find((s) => s.id === addStaffId) ?? availableStaff[0]
    if (!target) return
    setLines((prev) => [...prev, blankLine(target)])
    setAddStaffId('')
    setDirty(true)
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== index))
    setDirty(true)
  }

  async function saveLines() {
    if (!payroll || isLocked) return
    setNotice(null)
    try {
      await mutation.mutateAsync({
        method: 'PATCH',
        path: `/pos/payrolls/${payroll.id}`,
        body: { lines },
      })
      setDirty(false)
      setNotice({ text: t('saved'), failed: false })
    } catch (err) {
      setNotice({ text: describeFailure(err, t), failed: true })
    }
  }

  async function toggleFinalize() {
    if (!payroll || !access.write) return
    setNotice(null)
    try {
      if (dirty && payroll.status === 'draft') {
        await mutation.mutateAsync({
          method: 'PATCH',
          path: `/pos/payrolls/${payroll.id}`,
          body: { lines },
        })
      }
      await mutation.mutateAsync({
        method: 'POST',
        path: `/pos/payrolls/${payroll.id}/${payroll.status === 'draft' ? 'finalize' : 'reopen'}`,
        body: {},
      })
      setDirty(false)
      setNotice({ text: t('saved'), failed: false })
    } catch (err) {
      setNotice({ text: describeFailure(err, t), failed: true })
    }
  }

  function exportCsv() {
    if (!payroll) return
    const headers = [
      'STT',
      'Nhân viên',
      'Email',
      'Số SP',
      'Lương SP',
      'Số công',
      'Lương thời gian',
      'Nghỉ hưởng lương (công)',
      'Tiền nghỉ hưởng lương',
      'Phụ cấp quỹ lương',
      'Phụ cấp khác',
      'Thưởng',
      'Tổng thu nhập',
      'BHXH NLĐ',
      'BHYT NLĐ',
      'BHTN NLĐ',
      'Giảm trừ khác',
      'Thuế TNCN',
      'Cộng khấu trừ',
      'Thực lĩnh',
      'BHXH NSDLĐ',
      'BHYT NSDLĐ',
      'BHTN NSDLĐ',
      'Ghi chú',
    ]
    const csvRows = [
      headers.join(','),
      ...lines.map((l, i) =>
        [
          i + 1,
          `"${(l.staff?.full_name || l.staff?.email || '').replaceAll('"', '""')}"`,
          `"${(l.staff?.email || '').replaceAll('"', '""')}"`,
          l.piece_quantity,
          l.piece_amount,
          l.work_days,
          l.time_amount,
          l.paid_leave_days,
          l.paid_leave_amount,
          l.payroll_allowance,
          l.other_allowance,
          l.bonus,
          l.gross_amount,
          l.employee_bhxh,
          l.employee_bhyt,
          l.employee_bhtn,
          l.other_deduction,
          l.pit_tax,
          l.total_deductions,
          l.net_amount,
          l.employer_bhxh,
          l.employer_bhyt,
          l.employer_bhtn,
          `"${(l.note || '').replaceAll('"', '""')}"`,
        ].join(','),
      ),
    ]
    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${payroll.code}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (context.isPending || detailQuery.isPending) return <PageSkeleton />

  if (!payroll) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link to="/$storeId/payroll" params={{ storeId }}>
            <ArrowLeftIcon className="mr-1.5 size-4" />
            {t('payroll.backToList')}
          </Link>
        </Button>
        <p className="text-sm text-destructive">{t('adminNoResults')}</p>
      </div>
    )
  }

  const sumField = (field: keyof PayrollLine) => lines.reduce((acc, row) => acc + num(row[field] as string), 0)

  const numInput = (index: number, field: keyof PayrollLine, value: string, width = 'w-24') => (
    <input
      type="number"
      step="any"
      disabled={isLocked}
      value={value === '0' ? '' : value}
      placeholder="0"
      onChange={(e) => updateField(index, field, e.target.value || '0')}
      className={`${width} h-8 rounded border border-input bg-background px-2 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-muted/40`}
    />
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/$storeId/payroll" params={{ storeId }}>
              <ArrowLeftIcon className="mr-1 size-4" />
              {t('payroll.backToList')}
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">
                {payroll.code} — {payroll.name}
              </h1>
              <ActiveBadge
                active={payroll.status === 'finalized'}
                activeLabel={t('payroll.statusFinalized')}
                inactiveLabel={t('payroll.statusDraft')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {payroll.period_label ? `${payroll.period_label} · ` : ''}
              {payroll.period_start} → {payroll.period_end}
              {payroll.branch_name ? ` · ${payroll.branch_name}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <DownloadIcon className="mr-1.5 size-4" />
            CSV
          </Button>
          {access.write && payroll.status === 'draft' && (
            <Button
              type="button"
              size="sm"
              disabled={mutation.isPending || !dirty}
              onClick={() => void saveLines()}
            >
              {t(mutation.isPending ? 'waiting' : 'save')}
            </Button>
          )}
          {access.write && (
            <Button
              type="button"
              size="sm"
              variant={payroll.status === 'draft' ? 'default' : 'outline'}
              disabled={mutation.isPending}
              onClick={() => void toggleFinalize()}
            >
              {payroll.status === 'draft' ? (
                <>
                  <CheckCircle2Icon className="mr-1.5 size-4" />
                  {t('payroll.finalize')}
                </>
              ) : (
                <>
                  <RotateCcwIcon className="mr-1.5 size-4" />
                  {t('payroll.reopen')}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={`text-sm ${notice.failed ? 'text-destructive' : 'text-emerald-600'}`}
        >
          {notice.text}
        </p>
      )}

      {/* Multi-tier Vietnamese Accounting Payroll Spreadsheet */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/60 text-center font-semibold text-muted-foreground">
              <th rowSpan={2} className="border-r px-2 py-2">
                STT
              </th>
              <th rowSpan={2} className="min-w-44 border-r px-3 py-2 text-left">
                {t('adminStaff')}
              </th>
              <th colSpan={2} className="border-r px-2 py-1.5">
                {t('payroll.groupPiece')}
              </th>
              <th colSpan={2} className="border-r px-2 py-1.5">
                {t('payroll.groupTime')}
              </th>
              <th colSpan={2} className="border-r px-2 py-1.5">
                {t('payroll.groupLeave')}
              </th>
              <th colSpan={2} className="border-r px-2 py-1.5">
                {t('payroll.groupAllowance')}
              </th>
              <th rowSpan={2} className="border-r px-2 py-2">
                {t('payroll.colBonus')}
              </th>
              <th rowSpan={2} className="border-r bg-blue-50/60 px-2 py-2 text-blue-900">
                {t('payroll.colGross')}
              </th>
              <th colSpan={6} className="border-r bg-amber-50/50 px-2 py-1.5 text-amber-900">
                {t('payroll.groupDeductions')}
              </th>
              <th rowSpan={2} className="border-r bg-emerald-50/70 px-2 py-2 text-emerald-900">
                {t('payroll.colNet')}
              </th>
              <th colSpan={3} className="border-r px-2 py-1.5">
                {t('payroll.groupEmployer')}
              </th>
              <th rowSpan={2} className="px-2 py-2" />
            </tr>
            <tr className="border-b bg-muted/30 text-center text-[11px] font-medium text-muted-foreground">
              <th className="border-r px-2 py-1.5">{t('payroll.colPieceQty')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colAmount')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colWorkDays')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colAmount')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colLeaveDays')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colAmount')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colPayrollAllow')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colOtherAllow')}</th>
              <th className="border-r px-2 py-1.5">BHXH</th>
              <th className="border-r px-2 py-1.5">BHYT</th>
              <th className="border-r px-2 py-1.5">BHTN</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colOtherDeduct')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colPit')}</th>
              <th className="border-r px-2 py-1.5">{t('payroll.colTotalDeduct')}</th>
              <th className="border-r px-2 py-1.5">BHXH</th>
              <th className="border-r px-2 py-1.5">BHYT</th>
              <th className="border-r px-2 py-1.5">BHTN</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line, index) => (
              <tr key={line.staff_id} className="hover:bg-muted/20">
                <td className="border-r px-2 py-2 text-center tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="border-r px-3 py-2">
                  <div className="font-medium">{line.staff?.full_name || line.staff?.email}</div>
                  <div className="text-[11px] text-muted-foreground">{line.staff?.email}</div>
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'piece_quantity', line.piece_quantity, 'w-16')}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'piece_amount', line.piece_amount)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'work_days', line.work_days, 'w-16')}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'time_amount', line.time_amount)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'paid_leave_days', line.paid_leave_days, 'w-16')}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'paid_leave_amount', line.paid_leave_amount)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'payroll_allowance', line.payroll_allowance)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'other_allowance', line.other_allowance)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'bonus', line.bonus)}
                </td>
                <td className="border-r bg-blue-50/40 px-2.5 py-2 text-right font-semibold tabular-nums">
                  {fmtVnd(line.gross_amount)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'employee_bhxh', line.employee_bhxh)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'employee_bhyt', line.employee_bhyt)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'employee_bhtn', line.employee_bhtn)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'other_deduction', line.other_deduction)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'pit_tax', line.pit_tax)}
                </td>
                <td className="border-r bg-amber-50/40 px-2.5 py-2 text-right font-medium tabular-nums">
                  {fmtVnd(line.total_deductions)}
                </td>
                <td className="border-r bg-emerald-50/50 px-2.5 py-2 text-right font-bold tabular-nums text-emerald-700">
                  {fmtVnd(line.net_amount)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'employer_bhxh', line.employer_bhxh)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'employer_bhyt', line.employer_bhyt)}
                </td>
                <td className="border-r px-1.5 py-1.5">
                  {numInput(index, 'employer_bhtn', line.employer_bhtn)}
                </td>
                <td className="px-1.5 py-1.5 text-center">
                  {!isLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(index)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            <tr className="border-t-2 bg-muted/50 font-semibold">
              <td colSpan={2} className="border-r px-3 py-2.5 text-left uppercase">
                {t('payroll.grandTotal')} ({lines.length})
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {sumField('piece_quantity')}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('piece_amount'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {sumField('work_days')}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('time_amount'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {sumField('paid_leave_days')}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('paid_leave_amount'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('payroll_allowance'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('other_allowance'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('bonus'))}
              </td>
              <td className="border-r bg-blue-50/60 px-2.5 py-2 text-right tabular-nums text-blue-900">
                {fmtVnd(sumField('gross_amount'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('employee_bhxh'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('employee_bhyt'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('employee_bhtn'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('other_deduction'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('pit_tax'))}
              </td>
              <td className="border-r bg-amber-50/60 px-2.5 py-2 text-right tabular-nums">
                {fmtVnd(sumField('total_deductions'))}
              </td>
              <td className="border-r bg-emerald-50/70 px-2.5 py-2 text-right tabular-nums text-emerald-800">
                {fmtVnd(sumField('net_amount'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('employer_bhxh'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('employer_bhyt'))}
              </td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {fmtVnd(sumField('employer_bhtn'))}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add staff row bar */}
      {!isLocked && availableStaff.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t('payroll.addStaffRow')}
            className={`${selectClass} w-64`}
            value={addStaffId}
            onChange={(e) => setAddStaffId(e.target.value)}
          >
            <option value="">{t('payroll.chooseStaffToAdd')}</option>
            {availableStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name || s.email}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <PlusIcon className="mr-1 size-4" />
            {t('payroll.addStaffRow')}
          </Button>
        </div>
      )}
    </div>
  )
}
