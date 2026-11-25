import { PageHeader } from '@spree/dashboard-core'
import { Card } from '@spree/dashboard-ui'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
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
import { useReportOverview } from '../hooks/use-report-analytics'
import { useSession } from '../hooks/use-session'
import { dayText } from '../lib/report-table'

export function ReportsOverviewPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const branchId = context.data?.selection.branch_id ?? null

  const [range, setRange] = useState(() => presetRange('thisWeek'))
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'orders' | 'customers'>('revenue')
  const [topMode, setTopMode] = useState<'revenue' | 'quantity'>('revenue')

  const query = useReportOverview(branchId, range.from, range.to)
  const data = query.data
  const currency = data?.currency ?? context.data?.store.currency ?? 'VND'

  const trendPoints = (data?.trend ?? []).map((row) => ({
    label: dayText(row.date).slice(0, 5),
    value:
      trendMetric === 'revenue'
        ? Number(row.net_sales)
        : trendMetric === 'orders'
          ? row.orders
          : row.customers,
  }))

  const topProducts =
    topMode === 'quantity'
      ? (data?.top_products.by_quantity ?? [])
      : (data?.top_products.by_revenue ?? [])

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.overviewTitle')} actions={<BranchPicker />} />
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
              label="Tổng tiền đơn hàng"
              value={formatMoney(data?.kpis.gross_sales.value, currency)}
              changePct={data?.kpis.gross_sales.change_pct}
            />
            <KpiMetricCard
              label="Doanh thu thuần"
              value={formatMoney(data?.kpis.net_sales.value, currency)}
              changePct={data?.kpis.net_sales.change_pct}
              accent="success"
            />
            <KpiMetricCard
              label="Trung bình / đơn"
              value={formatMoney(data?.kpis.avg_order_value.value, currency)}
              changePct={data?.kpis.avg_order_value.change_pct}
            />
            <KpiMetricCard
              label="Khách hàng"
              value={formatNumber(data?.kpis.customers_count.value)}
              changePct={data?.kpis.customers_count.change_pct}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Chi tiết tổng tiền đơn hàng</h3>
                <Link
                  to="/$storeId/reports"
                  params={{ storeId }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Xem báo cáo doanh thu <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Tổng giá bán</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatMoney(data?.kpis.item_total, currency)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Giảm giá</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatMoney(data?.kpis.discount_total, currency)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Hoàn trả</p>
                  <p className="mt-1 font-semibold tabular-nums text-rose-600">
                    {formatMoney(data?.kpis.returns_total, currency)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Tiền thuế</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatMoney(data?.kpis.tax_total, currency)}
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4">
              <KpiMetricCard
                label="Lợi nhuận gộp"
                value={formatMoney(data?.kpis.gross_profit.value, currency)}
                changePct={data?.kpis.gross_profit.change_pct}
                hint={`Giá vốn: ${formatMoney(data?.kpis.cost_of_goods, currency)}`}
                accent="success"
              />
              <KpiMetricCard
                label="Tổng đơn hàng"
                value={formatNumber(data?.kpis.orders_count.value)}
                changePct={data?.kpis.orders_count.change_pct}
              />
            </div>
          </div>

          <SimpleSeriesChart
            title="Biểu đồ xu hướng"
            points={trendPoints}
            valueFormatter={(v) =>
              trendMetric === 'revenue' ? formatMoney(v, currency) : formatNumber(v)
            }
            controls={
              <div className="inline-flex rounded-md border p-0.5 text-xs">
                {(
                  [
                    ['revenue', 'Doanh thu'],
                    ['orders', 'Đơn hàng'],
                    ['customers', 'Khách hàng'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded px-2 py-1 ${trendMetric === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setTrendMetric(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Top 5 sản phẩm bán chạy</h3>
                <div className="inline-flex rounded-md border p-0.5 text-xs">
                  <button
                    type="button"
                    className={`rounded px-2 py-0.5 ${topMode === 'revenue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setTopMode('revenue')}
                  >
                    Doanh thu
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-0.5 ${topMode === 'quantity' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setTopMode('quantity')}
                  >
                    Số lượng
                  </button>
                </div>
              </div>
              {topProducts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
              ) : (
                <ul className="divide-y text-sm">
                  {topProducts.map((item, idx) => (
                    <li key={item.variant_id ?? idx} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {idx + 1}. {item.name}
                        </p>
                        {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {topMode === 'quantity'
                          ? `${formatNumber(item.quantity)} ${item.base_unit}`
                          : formatMoney(item.revenue, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Top 5 khách hàng mua nhiều</h3>
              {(data?.top_customers ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
              ) : (
                <ul className="divide-y text-sm">
                  {(data?.top_customers ?? []).map((item, idx) => (
                    <li key={`${item.name}-${idx}`} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {idx + 1}. {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.orders} đơn{item.phone ? ` · ${item.phone}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(item.revenue, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Top 5 nhân viên bán nhiều</h3>
              {(data?.top_staff ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
              ) : (
                <ul className="divide-y text-sm">
                  {(data?.top_staff ?? []).map((item, idx) => (
                    <li key={`${item.name}-${idx}`} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {idx + 1}. {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.orders} đơn</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(item.revenue, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Doanh thu theo nguồn đơn hàng</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(data?.by_source ?? []).map((src) => (
                <div key={src.order_source} className="rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t(`orderSource_${src.order_source}`, { defaultValue: src.order_source })}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatMoney(src.sales_total, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatNumber(src.orders)} đơn</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
