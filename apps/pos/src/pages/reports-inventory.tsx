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
import { useReportInventory } from '../hooks/use-report-analytics'
import { useSession } from '../hooks/use-session'
import { dayText } from '../lib/report-table'

export function ReportsInventoryPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const branchId = context.data?.selection.branch_id ?? null

  const [range, setRange] = useState(() => presetRange('thisMonth'))
  const [chartMetric, setChartMetric] = useState<'import' | 'export'>('import')

  const query = useReportInventory(branchId, range.from, range.to)
  const data = query.data
  const currency = data?.currency ?? context.data?.store.currency ?? 'VND'

  const trendPoints = (data?.trend ?? []).map((row) => ({
    label: dayText(row.date).slice(0, 5),
    value: chartMetric === 'import' ? Number(row.import_value) : Number(row.export_value),
  }))

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.inventoryTitle')} actions={<BranchPicker />} />
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
              label="Giá trị tồn kho"
              value={formatMoney(data?.stock.total_value, currency)}
              hint={`Tổng tồn: ${formatNumber(data?.stock.total_quantity)} đơn vị`}
            />
            <KpiMetricCard
              label="Số lượng tồn kho"
              value={formatNumber(data?.stock.total_quantity)}
            />
            <KpiMetricCard
              label="Giá trị nhập kho"
              value={formatMoney(data?.flow.import_value.value, currency)}
              changePct={data?.flow.import_value.change_pct}
              hint={`${formatNumber(data?.flow.import_count)} phiếu nhập`}
              accent="success"
            />
            <KpiMetricCard
              label="Giá trị xuất kho"
              value={formatMoney(data?.flow.export_value.value, currency)}
              changePct={data?.flow.export_value.change_pct}
              hint={`${formatNumber(data?.flow.export_count)} phiếu xuất`}
            />
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tình trạng sản phẩm trong kho</h3>
              <Link
                to="/$storeId/reports/inventory-summary"
                params={{ storeId }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Xem bảng Xuất - Nhập - Tồn <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Đang kinh doanh</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatNumber(data?.stock.active_products)}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Ngừng kinh doanh</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatNumber(data?.stock.inactive_products)}
                </p>
              </div>
              <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
                <p className="text-xs text-amber-700 dark:text-amber-300">Sắp hết hàng</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {formatNumber(data?.stock.low_stock_count)}
                </p>
              </div>
              <div className="rounded-md bg-rose-50 p-3 dark:bg-rose-950/30">
                <p className="text-xs text-rose-700 dark:text-rose-300">Đã hết hàng</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                  {formatNumber(data?.stock.out_of_stock_count)}
                </p>
              </div>
            </div>
          </Card>

          <SimpleSeriesChart
            title="Biểu đồ kho hàng"
            points={trendPoints}
            valueFormatter={(v) => formatMoney(v, currency)}
            controls={
              <div className="inline-flex rounded-md border p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 ${chartMetric === 'import' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setChartMetric('import')}
                >
                  Giá trị nhập
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 ${chartMetric === 'export' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setChartMetric('export')}
                >
                  Giá trị xuất
                </button>
              </div>
            }
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Top 5 sản phẩm có giá trị tồn cao nhất</h3>
              {(data?.top_products ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
              ) : (
                <ul className="divide-y text-sm">
                  {(data?.top_products ?? []).map((item, idx) => (
                    <li key={item.variant_id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {idx + 1}. {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku ? `${item.sku} · ` : ''}Tồn: {formatNumber(item.quantity)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(item.stock_value, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Top 5 danh mục có giá trị tồn cao nhất</h3>
              {(data?.top_categories ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
              ) : (
                <ul className="divide-y text-sm">
                  {(data?.top_categories ?? []).map((item, idx) => (
                    <li key={`${item.name}-${idx}`} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {idx + 1}. {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          SL tồn: {formatNumber(item.quantity)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(item.stock_value, currency)}
                      </span>
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
