import { formatMoney } from '@shared/money'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@spree/dashboard-ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelPage, ModelState } from '../components/setup/model-ui'
import {
  createTaxDeclaration,
  deleteTaxDeclaration,
  recalculateTaxDeclaration,
  type TaxDeclarationGroup,
  type TaxDeclarationRecord,
  type TaxDeclarationStatus,
  type TaxDeclarationType,
  updateTaxDeclaration,
  useTaxDeclarations,
} from '../hooks/use-accounting'
import { usePosContext } from '../hooks/use-pos-context'
import { useSession } from '../hooks/use-session'

const STATUS_BADGE: Record<TaxDeclarationStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  signed: 'outline',
  submitted: 'default',
  accepted: 'default',
  rejected: 'destructive',
}

function periodBoundsPreview(periodType: 'month' | 'quarter', year: number, num: number): string {
  if (periodType === 'month') {
    const start = new Date(year, num - 1, 1)
    const end = new Date(year, num, 0)
    return `${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`
  }
  const startMonth = (num - 1) * 3
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 0)
  return `${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`
}

function exportDeclarationCsv(record: TaxDeclarationRecord) {
  const rows: (string | number)[][] = [
    ['Mã tờ khai', record.code],
    ['Loại tờ khai', record.declaration_type],
    ['Kỳ kê khai', `${record.period_label} (${record.from_date} - ${record.to_date})`],
    ['Trạng thái', record.status],
    ['Tổng thuế phải nộp', String(record.summary.total_tax_due ?? '0')],
  ]
  if (record.summary.revenue_total !== undefined) {
    rows.push(['Tổng doanh thu', String(record.summary.revenue_total)])
  }
  if (record.summary.vat_total !== undefined) {
    rows.push(['Thuế GTGT', String(record.summary.vat_total)])
  }
  if (record.summary.output_vat !== undefined) {
    rows.push(['Thuế GTGT đầu ra', String(record.summary.output_vat)])
    rows.push(['Thuế GTGT đầu vào được khấu trừ', String(record.summary.input_vat ?? '0')])
  }
  if (record.summary.pit_total !== undefined) {
    rows.push(['Thuế TNCN', String(record.summary.pit_total)])
  }
  if (record.summary.gross_income_total !== undefined) {
    rows.push(['Tổng thu nhập chịu thuế', String(record.summary.gross_income_total)])
    rows.push(['Số lao động', String(record.summary.employee_count ?? 0)])
  }

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${record.code}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function TaxDeclarationsPage({ group }: { group: TaxDeclarationGroup }) {
  const { t } = useTranslation()
  const session = useSession()
  const context = usePosContext()
  const queryClient = useQueryClient()
  const canWrite = context.data?.administration?.write === true

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<TaxDeclarationRecord | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const query = useTaxDeclarations(group, {
    q,
    status: statusFilter || undefined,
    declaration_type: typeFilter || undefined,
  })

  const currency = query.data?.currency ?? 'VND'
  const money = (v: unknown) => formatMoney(String(v ?? '0'), currency)
  const readiness = query.data?.taxpayer.readiness

  const pageTitle =
    group === 'cnkd'
      ? t('accounting.cnkdTitle')
      : group === 'vat'
        ? t('accounting.vatTitle')
        : t('accounting.pitTitle')

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['pos', session.storeId, 'tax-declarations'] })

  const handleRecalculate = async (record: TaxDeclarationRecord) => {
    setBusyId(record.id)
    try {
      const res = await recalculateTaxDeclaration(record.id)
      await invalidate()
      if (selected?.id === record.id) setSelected(res.declaration)
    } finally {
      setBusyId(null)
    }
  }

  const handleStatusChange = async (record: TaxDeclarationRecord, status: TaxDeclarationStatus) => {
    setBusyId(record.id)
    try {
      const res = await updateTaxDeclaration(record.id, { status })
      await invalidate()
      if (selected?.id === record.id) setSelected(res.declaration)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (record: TaxDeclarationRecord) => {
    setBusyId(record.id)
    try {
      await deleteTaxDeclaration(record.id)
      await invalidate()
      if (selected?.id === record.id) setSelected(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ModelPage
      title={pageTitle}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/$storeId/settings/tax-info" params={{ storeId: session.storeId }}>
            <Button variant="outline" size="sm">
              <CheckCircle2 className="mr-1.5 size-4" />
              {t('taxInfo.title')}
              {readiness ? ` (${readiness.filled}/${readiness.total})` : ''}
            </Button>
          </Link>
          {canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              {t('accounting.createDeclaration')}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {readiness && readiness.filled < readiness.total && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {t('accounting.readinessNotice', {
                  filled: readiness.filled,
                  total: readiness.total,
                })}
              </span>
            </div>
            <Link
              to="/$storeId/settings/tax-info"
              params={{ storeId: session.storeId }}
              className="font-medium underline underline-offset-2"
            >
              {t('accounting.completeTaxInfo')}
            </Link>
          </div>
        )}

        {/* Filter Bar */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <Input
                placeholder={t('accounting.searchDeclaration')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {group === 'vat' && (
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">{t('accounting.allDeclarationTypes')}</option>
                <option value="04_gtgt">{t('accounting.declarationTypes.04_gtgt')}</option>
                <option value="01_gtgt">{t('accounting.declarationTypes.01_gtgt')}</option>
              </select>
            )}

            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{t('accounting.allStatuses')}</option>
              <option value="draft">{t('accounting.statuses.draft')}</option>
              <option value="signed">{t('accounting.statuses.signed')}</option>
              <option value="submitted">{t('accounting.statuses.submitted')}</option>
              <option value="accepted">{t('accounting.statuses.accepted')}</option>
              <option value="rejected">{t('accounting.statuses.rejected')}</option>
            </select>
          </CardContent>
        </Card>

        {query.isPending ? (
          <PageSkeleton />
        ) : query.isError || !query.data ? (
          <ModelState error title={t('accounting.loadError')} retry={() => void query.refetch()} />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2.5">{t('accounting.declarationCode')}</th>
                    <th className="px-4 py-2.5">{t('accounting.period')}</th>
                    <th className="px-4 py-2.5">{t('accounting.declarationType')}</th>
                    <th className="px-4 py-2.5 text-right">
                      {group === 'pit'
                        ? t('accounting.grossIncome')
                        : t('accounting.totalRevenue')}
                    </th>
                    <th className="px-4 py-2.5 text-right">{t('accounting.totalTaxDue')}</th>
                    <th className="px-4 py-2.5">{t('accounting.cqtStatus')}</th>
                    <th className="px-4 py-2.5 text-right">{t('accounting.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {query.data.declarations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        {t('accounting.noDeclarations')}
                      </td>
                    </tr>
                  ) : (
                    query.data.declarations.map((rec) => (
                      <tr key={rec.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs font-medium">{rec.code}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{rec.period_label}</div>
                          <div className="text-xs text-muted-foreground">
                            {rec.from_date} – {rec.to_date}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {t(`accounting.declarationTypes.${rec.declaration_type}`)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {group === 'pit'
                            ? money(rec.summary.gross_income_total)
                            : money(rec.summary.revenue_total)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {money(rec.summary.total_tax_due)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={STATUS_BADGE[rec.status]}>
                            {t(`accounting.statuses.${rec.status}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(rec)}
                              title={t('accounting.viewDetail')}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {canWrite && (rec.status === 'draft' || rec.status === 'rejected') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busyId === rec.id}
                                onClick={() => void handleRecalculate(rec)}
                                title={t('accounting.recalculate')}
                              >
                                <RefreshCw
                                  className={`size-4 ${busyId === rec.id ? 'animate-spin' : ''}`}
                                />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportDeclarationCsv(rec)}
                              title={t('accounting.exportCsv')}
                            >
                              <Download className="size-4" />
                            </Button>
                            {canWrite && rec.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busyId === rec.id}
                                onClick={() => void handleDelete(rec)}
                                title={t('accounting.delete')}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {createOpen && (
        <CreateDeclarationModal
          group={group}
          onClose={() => setCreateOpen(false)}
          onCreated={async (created) => {
            setCreateOpen(false)
            await invalidate()
            setSelected(created)
          }}
        />
      )}

      {selected && (
        <DeclarationDetailModal
          record={selected}
          currency={currency}
          canWrite={canWrite}
          busy={busyId === selected.id}
          onClose={() => setSelected(null)}
          onRecalculate={() => void handleRecalculate(selected)}
          onStatusChange={(s) => void handleStatusChange(selected, s)}
        />
      )}
    </ModelPage>
  )
}

function CreateDeclarationModal({
  group,
  onClose,
  onCreated,
}: {
  group: TaxDeclarationGroup
  onClose: () => void
  onCreated: (rec: TaxDeclarationRecord) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const now = new Date()
  const defaultQuarter = Math.floor(now.getMonth() / 3) + 1

  const defaultType: TaxDeclarationType =
    group === 'cnkd' ? '01_cnkd' : group === 'vat' ? '04_gtgt' : '05_kk_tncn'

  const [declarationType, setDeclarationType] = useState<TaxDeclarationType>(defaultType)
  const [periodType, setPeriodType] = useState<'month' | 'quarter'>('quarter')
  const [periodYear, setPeriodYear] = useState<number>(now.getFullYear())
  const [periodNumber, setPeriodNumber] = useState<number>(defaultQuarter)
  const [revenueSource, setRevenueSource] = useState<'all_orders' | 'einvoice_only'>('all_orders')
  const [dateField, setDateField] = useState<'completed_at' | 'created_at'>('completed_at')
  const [rateSource, setRateSource] = useState<'order_time' | 'current_config'>('order_time')
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [hasExcise, setHasExcise] = useState(false)
  const [hasResourceEnv, setHasResourceEnv] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]
  const rangeText = useMemo(
    () => periodBoundsPreview(periodType, periodYear, periodNumber),
    [periodType, periodYear, periodNumber],
  )

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await createTaxDeclaration({
        declaration_type: declarationType,
        period_type: periodType,
        period_year: periodYear,
        period_number: periodNumber,
        options:
          group === 'pit'
            ? {}
            : {
                revenue_source: revenueSource,
                date_field: dateField,
                rate_source: rateSource,
                include_cancelled: includeCancelled,
                has_excise: hasExcise,
                has_resource_env: hasResourceEnv,
              },
        note: note.trim() || undefined,
      })
      await onCreated(res.declaration)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('accounting.createError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('accounting.createDeclarationTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {group === 'vat' && (
            <div>
              <label className="mb-1 block text-xs font-medium">{t('accounting.declarationType')}</label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={declarationType}
                onChange={(e) => setDeclarationType(e.target.value as TaxDeclarationType)}
              >
                <option value="04_gtgt">{t('accounting.declarationTypes.04_gtgt')}</option>
                <option value="01_gtgt">{t('accounting.declarationTypes.01_gtgt')}</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">{t('accounting.periodType')}</label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2.5 text-sm"
                value={periodType}
                onChange={(e) => {
                  const next = e.target.value as 'month' | 'quarter'
                  setPeriodType(next)
                  setPeriodNumber(next === 'month' ? now.getMonth() + 1 : defaultQuarter)
                }}
              >
                <option value="quarter">{t('accounting.quarter')}</option>
                <option value="month">{t('accounting.month')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                {periodType === 'quarter' ? t('accounting.quarter') : t('accounting.month')}
              </label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2.5 text-sm"
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
              >
                {(periodType === 'quarter' ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map(
                  (n) => (
                    <option key={n} value={n}>
                      {periodType === 'quarter'
                        ? `${t('accounting.quarter')} ${n}`
                        : `${t('accounting.month')} ${n}`}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t('accounting.year')}</label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2.5 text-sm"
                value={periodYear}
                onChange={(e) => setPeriodYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {t('accounting.periodBounds')}: <strong>{rangeText}</strong>
          </div>

          {group !== 'pit' && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {t('accounting.revenueSource')}
                  </label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2.5 text-sm"
                    value={revenueSource}
                    onChange={(e) =>
                      setRevenueSource(e.target.value as 'all_orders' | 'einvoice_only')
                    }
                  >
                    <option value="all_orders">{t('accounting.allOrders')}</option>
                    <option value="einvoice_only">{t('accounting.einvoiceOnly')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {t('accounting.dateField')}
                  </label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2.5 text-sm"
                    value={dateField}
                    onChange={(e) => setDateField(e.target.value as 'completed_at' | 'created_at')}
                  >
                    <option value="completed_at">{t('accounting.completedDate')}</option>
                    <option value="created_at">{t('accounting.orderCreatedDate')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">{t('accounting.rateSource')}</label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2.5 text-sm"
                  value={rateSource}
                  onChange={(e) =>
                    setRateSource(e.target.value as 'order_time' | 'current_config')
                  }
                >
                  <option value="order_time">{t('accounting.rateAtOrderTime')}</option>
                  <option value="current_config">{t('accounting.rateCurrentConfig')}</option>
                </select>
              </div>

              {group === 'cnkd' && (
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeCancelled}
                      onChange={(e) => setIncludeCancelled(e.target.checked)}
                    />
                    <span>{t('accounting.includeCancelled')}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasExcise}
                      onChange={(e) => setHasExcise(e.target.checked)}
                    />
                    <span>{t('accounting.hasExcise')}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasResourceEnv}
                      onChange={(e) => setHasResourceEnv(e.target.checked)}
                    />
                    <span>{t('accounting.hasResourceEnv')}</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium">{t('accounting.note')}</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('accounting.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? t('accounting.creating') : t('accounting.createDeclaration')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeclarationDetailModal({
  record,
  currency,
  canWrite,
  busy,
  onClose,
  onRecalculate,
  onStatusChange,
}: {
  record: TaxDeclarationRecord
  currency: string
  canWrite: boolean
  busy: boolean
  onClose: () => void
  onRecalculate: () => void
  onStatusChange: (status: TaxDeclarationStatus) => void
}) {
  const { t } = useTranslation()
  const money = (v: unknown) => formatMoney(String(v ?? '0'), currency)
  const byRate = (record.summary.by_rate as
    | { rate_key: string; order_count: number; revenue: string; vat_amount: string; pit_amount: string }[]
    | undefined) ?? []
  const employees = (record.summary.employees as
    | { staff_id: string; staff_name: string; gross_income: string; taxable_income: string; pit_withheld: string }[]
    | undefined) ?? []

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {record.code} · {record.period_label}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-xs">
            <div>
              <div className="font-medium">
                {t(`accounting.declarationTypes.${record.declaration_type}`)}
              </div>
              <div className="text-muted-foreground">
                {record.taxpayer_snapshot.store_name}
                {record.taxpayer_snapshot.tax_code
                  ? ` · MST: ${record.taxpayer_snapshot.tax_code}`
                  : ''}
              </div>
            </div>
            <Badge variant={STATUS_BADGE[record.status]}>
              {t(`accounting.statuses.${record.status}`)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {record.declaration_type === '05_kk_tncn' ? (
              <>
                <SummaryBox
                  label={t('accounting.employeeCount')}
                  value={String(record.summary.employee_count ?? 0)}
                />
                <SummaryBox
                  label={t('accounting.grossIncome')}
                  value={money(record.summary.gross_income_total)}
                />
                <SummaryBox
                  label={t('accounting.totalTaxDue')}
                  value={money(record.summary.total_tax_due)}
                />
              </>
            ) : (
              <>
                <SummaryBox
                  label={t('accounting.totalRevenue')}
                  value={money(record.summary.revenue_total)}
                />
                {record.declaration_type === '01_cnkd' ? (
                  <SummaryBox
                    label={`${t('accounting.vat')} / ${t('accounting.pit')}`}
                    value={`${money(record.summary.vat_total)} / ${money(record.summary.pit_total)}`}
                  />
                ) : (
                  <SummaryBox
                    label={t('accounting.outputInputVat')}
                    value={`${money(record.summary.output_vat)} / ${money(record.summary.input_vat)}`}
                  />
                )}
                <SummaryBox
                  label={t('accounting.totalTaxDue')}
                  value={money(record.summary.total_tax_due)}
                />
              </>
            )}
          </div>

          {byRate.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="px-3 py-2">{t('accounting.rateGroup')}</th>
                    <th className="px-3 py-2 text-right">{t('accounting.orderCount')}</th>
                    <th className="px-3 py-2 text-right">{t('accounting.totalRevenue')}</th>
                    <th className="px-3 py-2 text-right">{t('accounting.vat')}</th>
                    <th className="px-3 py-2 text-right">{t('accounting.pit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byRate.map((b) => (
                    <tr key={b.rate_key}>
                      <td className="px-3 py-2 font-mono">{b.rate_key}</td>
                      <td className="px-3 py-2 text-right">{b.order_count}</td>
                      <td className="px-3 py-2 text-right">{money(b.revenue)}</td>
                      <td className="px-3 py-2 text-right">{money(b.vat_amount)}</td>
                      <td className="px-3 py-2 text-right">{money(b.pit_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {employees.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="px-3 py-2">{t('accounting.employee')}</th>
                    <th className="px-3 py-2 text-right">{t('accounting.grossIncome')}</th>
                    <th className="px-3 py-2 text-right">{t('accounting.taxableIncome')}</th>
                    <th className="px-3 py-2 text-right">{t('accounting.pitWithheld')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((e) => (
                    <tr key={e.staff_id}>
                      <td className="px-3 py-2 font-medium">{e.staff_name}</td>
                      <td className="px-3 py-2 text-right">{money(e.gross_income)}</td>
                      <td className="px-3 py-2 text-right">{money(e.taxable_income)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{money(e.pit_withheld)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canWrite && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {(record.status === 'draft' || record.status === 'rejected') && (
                <Button variant="outline" size="sm" onClick={onRecalculate} disabled={busy}>
                  <RefreshCw className="mr-1.5 size-3.5" />
                  {t('accounting.recalculate')}
                </Button>
              )}
              {record.status === 'draft' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange('signed')}
                  disabled={busy}
                >
                  {t('accounting.markSigned')}
                </Button>
              )}
              {(record.status === 'draft' || record.status === 'signed') && (
                <Button
                  size="sm"
                  onClick={() => onStatusChange('submitted')}
                  disabled={busy}
                >
                  {t('accounting.markSubmitted')}
                </Button>
              )}
              {record.status === 'submitted' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onStatusChange('accepted')}
                    disabled={busy}
                  >
                    {t('accounting.markAccepted')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onStatusChange('rejected')}
                    disabled={busy}
                  >
                    {t('accounting.markRejected')}
                  </Button>
                </>
              )}
              {record.status === 'rejected' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange('draft')}
                  disabled={busy}
                >
                  {t('accounting.reopenDraft')}
                </Button>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => exportDeclarationCsv(record)}>
            <Download className="mr-1.5 size-4" />
            {t('accounting.exportCsv')}
          </Button>
          <Button onClick={onClose}>{t('accounting.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}
