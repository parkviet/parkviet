import { PageHeader } from '@spree/dashboard-core'
import { Badge, Card } from '@spree/dashboard-ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import {
  formatMoney,
  formatNumber,
  KpiMetricCard,
  presetRange,
  ReportDateBar,
  SimpleSeriesChart,
} from '../components/reports/analytics-ui'
import { usePosSession } from '../hooks/use-pos-session'
import { useReportTransaction } from '../hooks/use-report-analytics'
import { dayText } from '../lib/report-table'

const ACCOUNT_KIND_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  ewallet: 'Ví điện tử',
}

export function ReportsTransactionPage() {
  const { t } = useTranslation()
  const { context } = usePosSession()
  const branchId = context.data?.selection.branch_id ?? null

  const [range, setRange] = useState(() => presetRange('thisWeek'))
  const [tab, setTab] = useState<'income' | 'expense'>('income')

  const query = useReportTransaction(branchId, range.from, range.to)
  const data = query.data
  const currency = data?.currency ?? context.data?.store.currency ?? 'VND'

  const categories =
    tab === 'income' ? (data?.income_by_category ?? []) : (data?.expense_by_category ?? [])

  const trendPoints = (data?.trend ?? []).map((row) => ({
    label: dayText(row.date).slice(0, 5),
    value: tab === 'income' ? Number(row.income) : Number(row.expense),
  }))

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.transactionTitle')} actions={<BranchPicker />} />
      {!branchId ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : (
        <div className="space-y-6">
          <ReportDateBar
            from={range.from}
            to={range.to}
            period={data?.period}
            onChange={setRange}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiMetricCard
              label="Tổng thu"
              value={formatMoney(data?.summary.total_income.value, currency)}
              changePct={data?.summary.total_income.change_pct}
              hint={`Trung bình / ngày: ${formatMoney(data?.summary.avg_income_per_day, currency)}`}
              accent="success"
            />
            <KpiMetricCard
              label="Tổng chi"
              value={formatMoney(data?.summary.total_expense.value, currency)}
              changePct={data?.summary.total_expense.change_pct}
              hint={`Trung bình / ngày: ${formatMoney(data?.summary.avg_expense_per_day, currency)}`}
              accent="danger"
            />
            <KpiMetricCard
              label="Chênh lệch (Thu - Chi)"
              value={formatMoney(data?.summary.net_diff.value, currency)}
              changePct={data?.summary.net_diff.change_pct}
              accent={Number(data?.summary.net_diff.value ?? 0) >= 0 ? 'success' : 'danger'}
            />
          </div>

          <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 font-medium ${tab === 'income' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setTab('income')}
            >
              Khoản thu
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-1.5 font-medium ${tab === 'expense' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setTab('expense')}
            >
              Khoản chi
            </button>
          </div>

          <SimpleSeriesChart
            title={tab === 'income' ? 'Biểu đồ tổng thu theo ngày' : 'Biểu đồ tổng chi theo ngày'}
            points={trendPoints}
            valueFormatter={(v) => formatMoney(v, currency)}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {tab === 'income' ? 'Danh sách thu theo phân loại' : 'Danh sách chi theo phân loại'}
              </h3>
              {categories.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Chưa có phiếu {tab === 'income' ? 'thu' : 'chi'} trong kỳ.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {categories.map((cat) => (
                    <li
                      key={cat.category_code}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div>
                        <p className="font-medium">
                          {t(`finance.category.${cat.category_code}`, {
                            defaultValue: cat.category_code,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(cat.count)} phiếu
                        </p>
                      </div>
                      <span
                        className={`font-semibold tabular-nums ${tab === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {formatMoney(cat.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Danh sách nguồn tiền (Quỹ tiền)</h3>
              {(data?.by_account ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có quỹ tiền.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {(data?.by_account ?? []).map((acc) => (
                    <li key={acc.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{acc.name}</p>
                          <Badge variant="secondary" className="text-[11px]">
                            {ACCOUNT_KIND_LABEL[acc.kind] ?? acc.kind}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tab === 'income'
                            ? `Thu trong kỳ: ${formatMoney(acc.period_income, currency)}`
                            : `Chi trong kỳ: ${formatMoney(acc.period_expense, currency)}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">
                          {formatMoney(acc.current_balance, currency)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Số dư hiện tại</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
