import { formatMoney } from '@shared/money'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@spree/dashboard-ui'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Settings2,
  AlertTriangle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelPage, ModelState } from '../components/setup/model-ui'
import {
  type AccountingBookCode,
  type AccountingBookFilters,
  type AccountingBookResponse,
  useAccountingBook,
  useAccountingBooksOverview,
} from '../hooks/use-accounting'
import { usePosContext } from '../hooks/use-pos-context'
import { useSession } from '../hooks/use-session'

const BOOK_ORDER: AccountingBookCode[] = ['s1a', 's2a', 's2b', 's2c', 's2d', 's2e']

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AccountingBooksPage() {
  const { t } = useTranslation()
  const session = useSession()
  const overview = useAccountingBooksOverview()

  const recommended = useMemo(() => {
    const regime = overview.data?.taxpayer.regime
    if (!regime) return new Set<AccountingBookCode>(['s2a', 's2d', 's2e'])
    if (regime.revenue_group === 'group_1' || !regime.enabled) {
      return new Set<AccountingBookCode>(['s1a'])
    }
    if (regime.pit_method === 'income') {
      return new Set<AccountingBookCode>(['s2b', 's2c', 's2d', 's2e'])
    }
    return new Set<AccountingBookCode>(['s2a', 's2d', 's2e'])
  }, [overview.data])

  const readiness = overview.data?.taxpayer.readiness

  return (
    <ModelPage
      title={t('accounting.booksTitle')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/$storeId/settings/tax-info" params={{ storeId: session.storeId }}>
            <Button variant="outline" size="sm">
              <CheckCircle2 className="mr-1.5 size-4" />
              {t('taxInfo.title')}
              {readiness ? ` (${readiness.filled}/${readiness.total})` : ''}
            </Button>
          </Link>
          <Link to="/$storeId/settings/tax" params={{ storeId: session.storeId }}>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-1.5 size-4" />
              {t('accounting.taxConfigLink')}
            </Button>
          </Link>
        </div>
      }
    >
      {overview.isPending ? (
        <PageSkeleton />
      ) : overview.isError || !overview.data ? (
        <ModelState
          error
          title={t('accounting.loadError')}
          retry={() => void overview.refetch()}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('accounting.booksSubtitle')}</p>

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BOOK_ORDER.map((code) => {
              const isRecommended = recommended.has(code)
              return (
                <Card
                  key={code}
                  className="flex flex-col justify-between transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-primary" />
                        <CardTitle className="text-base">
                          {t(`accounting.bookNames.${code}`)}
                        </CardTitle>
                      </div>
                      {isRecommended && (
                        <Badge variant="secondary">{t('accounting.recommended')}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">{t(`accounting.bookSubtitles.${code}`)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`accounting.bookDescriptions.${code}`)}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link
                        to="/$storeId/accounting/books/$bookCode"
                        params={{ storeId: session.storeId, bookCode: code }}
                      >
                        <Button variant="outline" size="sm" className="w-full justify-between">
                          {t('accounting.openBook')}
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </ModelPage>
  )
}

export function AccountingBookDetailPage({ bookCode }: { bookCode: AccountingBookCode }) {
  const { t } = useTranslation()
  const session = useSession()
  const context = usePosContext()
  const now = new Date()
  const defaultQuarter = Math.floor(now.getMonth() / 3) + 1

  const [periodType, setPeriodType] = useState<'month' | 'quarter'>('quarter')
  const [periodYear, setPeriodYear] = useState<number>(now.getFullYear())
  const [periodNumber, setPeriodNumber] = useState<number>(defaultQuarter)
  const [branchId, setBranchId] = useState<string>('')
  const [revenueSource, setRevenueSource] = useState<'all_orders' | 'einvoice_only'>('all_orders')
  const [dateField, setDateField] = useState<'completed_at' | 'created_at'>('completed_at')
  const [rateSource, setRateSource] = useState<'order_time' | 'current_config'>('order_time')

  const filters: AccountingBookFilters = {
    period_type: periodType,
    period_year: periodYear,
    period_number: periodNumber,
    branch_id: branchId || undefined,
    revenue_source: revenueSource,
    date_field: dateField,
    rate_source: rateSource,
  }

  const query = useAccountingBook(bookCode, filters)
  const data = query.data
  const currency = data?.currency ?? 'VND'
  const money = (v: string | number | undefined) => formatMoney(String(v ?? '0'), currency)

  const branches = context.data?.branches ?? []
  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const handleExport = () => {
    if (!data) return
    const suffix = `${data.from_date}_${data.to_date}`
    if (bookCode === 's1a' || bookCode === 's2a' || bookCode === 's2b') {
      const rows = (data.rows ?? []).map((r) => [
        r.stt,
        r.document_number,
        r.document_date ?? '',
        r.description,
        r.revenue,
        r.vat_amount,
        r.pit_amount,
      ])
      downloadCsv(
        `so-${bookCode}-${suffix}.csv`,
        ['STT', 'Số chứng từ', 'Ngày tháng', 'Diễn giải', 'Doanh thu', 'Thuế GTGT', 'Thuế TNCN'],
        rows,
      )
    } else if (bookCode === 's2c') {
      const rows: (string | number)[][] = [
        ['1', 'Doanh thu bán hàng hóa, dịch vụ', data.summary.total_revenue ?? '0'],
      ]
      for (const sec of data.expense_sections ?? []) {
        rows.push([`2.${sec.key}`, t(`accounting.s2cGroups.${sec.key}`), sec.amount])
      }
      rows.push(['3', 'Chênh lệch (1) - (2)', data.summary.net_income ?? '0'])
      rows.push(['4', 'Thuế TNCN phải nộp', data.summary.pit_payable ?? '0'])
      downloadCsv(`so-s2c-${suffix}.csv`, ['Mục', 'Chỉ tiêu', 'Số tiền (VNĐ)'], rows)
    } else if (bookCode === 's2d') {
      const rows = (data.items ?? []).map((item) => [
        item.sku,
        item.name,
        item.opening_qty,
        item.opening_value,
        item.in_qty,
        item.in_value,
        item.out_qty,
        item.out_value,
        item.closing_qty,
        item.closing_value,
      ])
      downloadCsv(
        `so-s2d-${suffix}.csv`,
        ['SKU', 'Tên hàng hóa', 'SL đầu kỳ', 'GT đầu kỳ', 'SL nhập', 'GT nhập', 'SL xuất', 'GT xuất', 'SL cuối kỳ', 'GT cuối kỳ'],
        rows,
      )
    } else if (bookCode === 's2e') {
      const rows: (string | number)[][] = []
      for (const acc of data.accounts ?? []) {
        for (const r of acc.rows) {
          rows.push([acc.name, r.code, r.date ?? '', r.description, r.in_amount, r.out_amount, r.balance])
        }
      }
      downloadCsv(
        `so-s2e-${suffix}.csv`,
        ['Quỹ tiền', 'Số chứng từ', 'Ngày', 'Diễn giải', 'Thu / Gửi vào', 'Chi / Rút ra', 'Tồn cuối'],
        rows,
      )
    }
  }

  return (
    <ModelPage
      title={t(`accounting.bookNames.${bookCode}`)}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/$storeId/accounting/books" params={{ storeId: session.storeId }}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 size-4" />
              {t('accounting.backToOverview')}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`mr-1.5 size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            {t('accounting.refreshData')}
          </Button>
          <Button variant="default" size="sm" onClick={handleExport} disabled={!data}>
            <Download className="mr-1.5 size-4" />
            {t('accounting.exportCsv')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t(`accounting.bookSubtitles.${bookCode}`)}</p>

        {/* Filter Bar */}
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('accounting.periodType')}
              </label>
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('accounting.year')}
              </label>
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

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('accounting.branch')}
              </label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2.5 text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">{t('accounting.allBranches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {['s1a', 's2a', 's2b', 's2c'].includes(bookCode) && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('accounting.rateSource')}
                  </label>
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
              </>
            )}
          </CardContent>
        </Card>

        {query.isPending ? (
          <PageSkeleton />
        ) : query.isError || !data ? (
          <ModelState error title={t('accounting.loadError')} retry={() => void query.refetch()} />
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              {t('accounting.periodRange', { from: data.from_date, to: data.to_date })} ·{' '}
              {data.taxpayer.store_name}
              {data.taxpayer.tax_code ? ` · MST: ${data.taxpayer.tax_code}` : ''}
            </div>

            {['s1a', 's2a', 's2b'].includes(bookCode) && (
              <RevenueBookView bookCode={bookCode} data={data} money={money} />
            )}
            {bookCode === 's2c' && <S2cBookView data={data} money={money} />}
            {bookCode === 's2d' && <S2dBookView data={data} money={money} />}
            {bookCode === 's2e' && <S2eBookView data={data} money={money} />}

            {/* Statutory Signature Footer */}
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-4 text-center text-sm sm:grid-cols-3">
                <div>
                  <div className="font-medium">{t('accounting.preparer')}</div>
                  <div className="mt-6 text-muted-foreground">
                    {data.taxpayer.preparer_name || '—'}
                  </div>
                </div>
                <div>
                  <div className="font-medium">
                    {bookCode === 's2d'
                      ? t('accounting.storekeeper')
                      : bookCode === 's2e'
                        ? t('accounting.cashier')
                        : t('accounting.accountant')}
                  </div>
                  <div className="mt-6 text-muted-foreground">
                    {bookCode === 's2d'
                      ? data.taxpayer.storekeeper_name || '—'
                      : bookCode === 's2e'
                        ? data.taxpayer.cashier_name || '—'
                        : '—'}
                  </div>
                </div>
                <div>
                  <div className="font-medium">{t('accounting.signer')}</div>
                  <div className="mt-6 text-muted-foreground">
                    {data.taxpayer.signer_name || '—'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ModelPage>
  )
}

function RevenueBookView({
  bookCode,
  data,
  money,
}: {
  bookCode: AccountingBookCode
  data: AccountingBookResponse
  money: (v: string | number | undefined) => string
}) {
  const { t } = useTranslation()
  const rows = data.rows ?? []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={t('accounting.totalRevenue')} value={money(data.summary.total_revenue)} />
        {(bookCode === 's2a' || bookCode === 's2b') && (
          <KpiCard label={t('accounting.totalVat')} value={money(data.summary.total_vat)} />
        )}
        {bookCode === 's2a' && (
          <KpiCard label={t('accounting.totalPit')} value={money(data.summary.total_pit)} />
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2.5">STT</th>
                <th className="px-4 py-2.5">{t('accounting.docNumber')}</th>
                <th className="px-4 py-2.5">{t('accounting.docDate')}</th>
                <th className="px-4 py-2.5">{t('accounting.description')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.amount')}</th>
                {(bookCode === 's2a' || bookCode === 's2b') && (
                  <th className="px-4 py-2.5 text-right">{t('accounting.vat')}</th>
                )}
                {bookCode === 's2a' && (
                  <th className="px-4 py-2.5 text-right">{t('accounting.pit')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {t('accounting.emptyPeriod')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.order_id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground">{r.stt}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.document_number}</td>
                    <td className="px-4 py-2.5">{r.document_date}</td>
                    <td className="px-4 py-2.5">{r.description}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{money(r.revenue)}</td>
                    {(bookCode === 's2a' || bookCode === 's2b') && (
                      <td className="px-4 py-2.5 text-right">{money(r.vat_amount)}</td>
                    )}
                    {bookCode === 's2a' && (
                      <td className="px-4 py-2.5 text-right">{money(r.pit_amount)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function S2cBookView({
  data,
  money,
}: {
  data: AccountingBookResponse
  money: (v: string | number | undefined) => string
}) {
  const { t } = useTranslation()
  const excluded = Number(data.summary.total_excluded_expense ?? 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('accounting.totalRevenue')} value={money(data.summary.total_revenue)} />
        <KpiCard
          label={t('accounting.deductibleExpense')}
          value={money(data.summary.total_deductible_expense)}
        />
        <KpiCard label={t('accounting.netIncome')} value={money(data.summary.net_income)} />
        <KpiCard label={t('accounting.pitPayable')} value={money(data.summary.pit_payable)} />
      </div>

      {excluded > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t('accounting.s2cExcludedNote', { amount: money(excluded) })}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="w-20 px-4 py-2.5">{t('accounting.sectionCode')}</th>
                <th className="px-4 py-2.5">{t('accounting.indicator')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.voucherCount')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="bg-muted/20 font-semibold">
                <td className="px-4 py-2.5">1</td>
                <td className="px-4 py-2.5">{t('accounting.s2cRevenueHeading')}</td>
                <td className="px-4 py-2.5 text-right">{(data.revenue_rows ?? []).length}</td>
                <td className="px-4 py-2.5 text-right">{money(data.summary.total_revenue)}</td>
              </tr>
              <tr className="bg-muted/20 font-semibold">
                <td className="px-4 py-2.5">2</td>
                <td className="px-4 py-2.5">{t('accounting.s2cExpenseHeading')}</td>
                <td className="px-4 py-2.5 text-right">
                  {(data.expense_sections ?? []).reduce((s, g) => s + g.count, 0)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {money(data.summary.total_deductible_expense)}
                </td>
              </tr>
              {(data.expense_sections ?? []).map((sec) => (
                <tr key={sec.key} className="hover:bg-muted/10">
                  <td className="px-4 py-2 pl-8 text-muted-foreground">
                    {sec.key === 'dd' ? 'đ)' : `${sec.key})`}
                  </td>
                  <td className="px-4 py-2">{t(`accounting.s2cGroups.${sec.key}`)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{sec.count}</td>
                  <td className="px-4 py-2 text-right">{money(sec.amount)}</td>
                </tr>
              ))}
              <tr className="bg-muted/20 font-semibold">
                <td className="px-4 py-2.5">3</td>
                <td className="px-4 py-2.5">{t('accounting.s2cNetHeading')}</td>
                <td className="px-4 py-2.5 text-right">—</td>
                <td className="px-4 py-2.5 text-right">{money(data.summary.net_income)}</td>
              </tr>
              <tr className="bg-primary/5 font-semibold">
                <td className="px-4 py-2.5">4</td>
                <td className="px-4 py-2.5">{t('accounting.s2cPitHeading')}</td>
                <td className="px-4 py-2.5 text-right">
                  {Math.round(Number(data.summary.pit_income_rate ?? 0.15) * 100)}%
                </td>
                <td className="px-4 py-2.5 text-right">{money(data.summary.pit_payable)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function S2dBookView({
  data,
  money,
}: {
  data: AccountingBookResponse
  money: (v: string | number | undefined) => string
}) {
  const { t } = useTranslation()
  const items = data.items ?? []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={t('accounting.totalImportValue')} value={money(data.summary.total_in_value)} />
        <KpiCard label={t('accounting.totalExportValue')} value={money(data.summary.total_out_value)} />
        <KpiCard
          label={t('accounting.closingStockValue')}
          value={money(data.summary.closing_stock_value)}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5">{t('accounting.itemName')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.openingStock')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.periodIn')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.periodOut')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.closingStock')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {t('accounting.emptyPeriod')}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.variant_id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-mono text-xs">{item.sku}</td>
                    <td className="px-4 py-2.5 font-medium">{item.name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div>{item.opening_qty}</div>
                      <div className="text-xs text-muted-foreground">{money(item.opening_value)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-400">
                      <div>+{item.in_qty}</div>
                      <div className="text-xs">{money(item.in_value)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-rose-700 dark:text-rose-400">
                      <div>-{item.out_qty}</div>
                      <div className="text-xs">{money(item.out_value)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      <div>{item.closing_qty}</div>
                      <div className="text-xs text-muted-foreground">{money(item.closing_value)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function S2eBookView({
  data,
  money,
}: {
  data: AccountingBookResponse
  money: (v: string | number | undefined) => string
}) {
  const { t } = useTranslation()
  const accounts = data.accounts ?? []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={t('accounting.totalCashIn')} value={money(data.summary.total_in)} />
        <KpiCard label={t('accounting.totalCashOut')} value={money(data.summary.total_out)} />
        <KpiCard label={t('accounting.closingCash')} value={money(data.summary.closing_balance)} />
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('accounting.emptyPeriod')}
          </CardContent>
        </Card>
      ) : (
        accounts.map((acc) => (
          <Card key={acc.account_id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">{acc.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {acc.kind === 'cash' ? t('accounting.cashFund') : t('accounting.bankFund')}
                  {acc.account_number ? ` · ${acc.account_number}` : ''}
                </p>
              </div>
              <div className="text-right text-xs">
                <div>
                  {t('accounting.openingBalance')}: <strong>{money(acc.opening_balance)}</strong>
                </div>
                <div>
                  {t('accounting.closingBalance')}: <strong>{money(acc.closing_balance)}</strong>
                </div>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2">{t('accounting.docNumber')}</th>
                    <th className="px-4 py-2">{t('accounting.docDate')}</th>
                    <th className="px-4 py-2">{t('accounting.description')}</th>
                    <th className="px-4 py-2 text-right">{t('accounting.cashIn')}</th>
                    <th className="px-4 py-2 text-right">{t('accounting.cashOut')}</th>
                    <th className="px-4 py-2 text-right">{t('accounting.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {acc.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-xs text-muted-foreground">
                        {t('accounting.noMovementsInPeriod')}
                      </td>
                    </tr>
                  ) : (
                    acc.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                        <td className="px-4 py-2">{r.date}</td>
                        <td className="px-4 py-2">{r.description}</td>
                        <td className="px-4 py-2 text-right text-emerald-700 dark:text-emerald-400">
                          {Number(r.in_amount) > 0 ? money(r.in_amount) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-rose-700 dark:text-rose-400">
                          {Number(r.out_amount) > 0 ? money(r.out_amount) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{money(r.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}
