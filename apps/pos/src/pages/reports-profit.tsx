import { PageHeader } from '@spree/dashboard-core'
import { Card } from '@spree/dashboard-ui'
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
import { type ProfitGroupBy, useReportProfit } from '../hooks/use-report-analytics'
import { dayText } from '../lib/report-table'

const GROUP_TABS: Array<{ key: ProfitGroupBy; label: string; colLabel: string }> = [
  { key: 'day', label: 'Ngày', colLabel: 'Ngày' },
  { key: 'order', label: 'Đơn hàng', colLabel: 'Mã đơn hàng' },
  { key: 'product', label: 'Sản phẩm', colLabel: 'Sản phẩm' },
  { key: 'customer', label: 'Khách hàng', colLabel: 'Khách hàng' },
  { key: 'staff', label: 'Nhân viên', colLabel: 'Tên nhân viên' },
]

export function ReportsProfitPage() {
  const { t } = useTranslation()
  const { context } = usePosSession()
  const branchId = context.data?.selection.branch_id ?? null

  const [range, setRange] = useState(() => presetRange('thisWeek'))
  const [groupBy, setGroupBy] = useState<ProfitGroupBy>('day')

  const query = useReportProfit(branchId, range.from, range.to, groupBy)
  const data = query.data
  const pnl = data?.pnl
  const currency = data?.currency ?? context.data?.store.currency ?? 'VND'

  const activeTab = GROUP_TABS.find((item) => item.key === groupBy) ?? GROUP_TABS[0]

  const trendPoints = (data?.trend ?? []).map((row) => ({
    label: dayText(row.date).slice(0, 5),
    value: Number(row.gross_profit),
  }))

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.profitTitle')} actions={<BranchPicker />} />
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiMetricCard
              label="Doanh thu thuần"
              value={formatMoney(pnl?.net_sales, currency)}
            />
            <KpiMetricCard
              label="Giá vốn hàng bán"
              value={formatMoney(pnl?.cogs, currency)}
            />
            <KpiMetricCard
              label="Lợi nhuận gộp"
              value={formatMoney(pnl?.gross_profit, currency)}
              hint={`Biên gộp: ${pnl?.gross_margin_rate ?? 0}%`}
              accent="success"
            />
            <KpiMetricCard
              label="Tổng lợi nhuận (P&L)"
              value={formatMoney(pnl?.net_profit, currency)}
              changePct={pnl?.net_profit_change_pct}
              accent={Number(pnl?.net_profit ?? 0) >= 0 ? 'success' : 'danger'}
            />
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Chi tiết lợi nhuận (Báo cáo lãi lỗ)</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Doanh thu
                </p>
                <div className="flex justify-between py-1">
                  <span>Tổng giá bán hàng hóa</span>
                  <span className="tabular-nums">{formatMoney(pnl?.item_total, currency)}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>(-) Giảm giá</span>
                  <span className="tabular-nums">{formatMoney(pnl?.discount_total, currency)}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>(-) Hoàn trả hàng</span>
                  <span className="tabular-nums">{formatMoney(pnl?.returns_total, currency)}</span>
                </div>
                <div className="flex justify-between border-t py-1.5 font-medium">
                  <span>Doanh thu thuần (2)</span>
                  <span className="tabular-nums">{formatMoney(pnl?.net_sales, currency)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Doanh thu khác (Phiếu thu) (4)</span>
                  <span className="tabular-nums">{formatMoney(pnl?.other_income, currency)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Tổng doanh thu (5) = (2) + (4)</span>
                  <span className="tabular-nums">{formatMoney(pnl?.total_revenue, currency)}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chi phí &amp; Lợi nhuận
                </p>
                <div className="flex justify-between py-1">
                  <span>Giá vốn hàng bán (6)</span>
                  <span className="tabular-nums">{formatMoney(pnl?.cogs, currency)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Chi phí khác (Phiếu chi) (7)</span>
                  <span className="tabular-nums">{formatMoney(pnl?.other_expense, currency)}</span>
                </div>
                <div className="flex justify-between border-t py-1.5 font-medium">
                  <span>Tổng chi phí (8) = (6) + (7)</span>
                  <span className="tabular-nums">{formatMoney(pnl?.total_expense, currency)}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-600">
                  <span>Lợi nhuận gộp (9) = (2) - (6)</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(pnl?.gross_profit, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Lợi nhuận khác (10) = (4) - (7)</span>
                  <span className="tabular-nums">{formatMoney(pnl?.other_profit, currency)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Tổng lợi nhuận = (9) + (10)</span>
                  <span className="tabular-nums text-emerald-600">
                    {formatMoney(pnl?.net_profit, currency)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <SimpleSeriesChart
            title="Biểu đồ lợi nhuận gộp theo ngày"
            points={trendPoints}
            valueFormatter={(v) => formatMoney(v, currency)}
          />

          <Card className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Lợi nhuận theo</h3>
              <div className="inline-flex flex-wrap rounded-md border p-0.5 text-xs">
                {GROUP_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`rounded px-3 py-1.5 ${groupBy === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setGroupBy(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">{activeTab.colLabel}</th>
                    <th className="py-2 pr-3 text-right">
                      {groupBy === 'product' ? 'SL bán' : 'SL đơn'}
                    </th>
                    <th className="py-2 pr-3 text-right">Tổng tiền đơn hàng</th>
                    <th className="py-2 pr-3 text-right">Doanh thu thuần</th>
                    <th className="py-2 pr-3 text-right">Giá vốn</th>
                    <th className="py-2 text-right">Lợi nhuận gộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.breakdown ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Không có dữ liệu trong khoảng thời gian này.
                      </td>
                    </tr>
                  ) : (
                    (data?.breakdown ?? []).map((row, idx) => (
                      <tr key={`${row.label}-${idx}`}>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">
                            {groupBy === 'day' ? dayText(row.label) : row.label}
                          </p>
                          {row.secondary && (
                            <p className="text-xs text-muted-foreground">{row.secondary}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatNumber(row.count)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatMoney(row.gross_sales, currency)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatMoney(row.net_sales, currency)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                          {formatMoney(row.cogs, currency)}
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-emerald-600">
                          {formatMoney(row.gross_profit, currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
