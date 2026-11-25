import { downloadCsv } from '@shared/finance'
import { describeFailure } from '@shared/request-failure'
import { PageHeader } from '@spree/dashboard-core'
import { Badge, Button, Card, CardContent } from '@spree/dashboard-ui'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { PageSkeleton } from '../components/page-skeleton'
import { Input, Select } from '../components/topology-fields'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import { type StockOverviewItem, useStockOverview } from '../hooks/use-stock'

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
const fmtVnd = (raw: string | number) => vnd.format(Number(raw || 0))

export function StockOverviewPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { selection } = usePosSession()
  const branchId = selection.branchId

  const [q, setQ] = useState('')
  const [itemKind, setItemKind] = useState('all')
  const [stockStatus, setStockStatus] = useState('all')
  const [tracked, setTracked] = useState('all')

  const overview = useStockOverview(branchId, {
    q: q.trim() || undefined,
    item_kind: itemKind !== 'all' ? itemKind : undefined,
    stock_status: stockStatus !== 'all' ? stockStatus : undefined,
    tracked: tracked !== 'all' ? tracked : undefined,
  })

  const summary = overview.data?.meta.summary
  const rows = overview.data?.data ?? []

  function exportCsv() {
    downloadCsv(
      `ton-kho-${new Date().toISOString().slice(0, 10)}.csv`,
      ['SKU', 'Tên hàng', 'Loại', 'ĐVT', 'Giá vốn', 'Tồn kho', 'Giá trị kho', 'Trạng thái'],
      rows.map((r: StockOverviewItem) => [
        r.sku ?? '',
        [r.name, r.options_text].filter(Boolean).join(' · '),
        r.item_kind === 'ingredient' ? t('stock.itemKind_ingredient') : t('stock.itemKind_product'),
        r.base_unit,
        r.cost_price,
        r.on_hand,
        r.stock_value,
        t(`stock.status_${r.stock_status}`),
      ]),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stock.overviewTitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              {t('stock.exportCsv')}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/$storeId/stock/counts" params={{ storeId }}>
                {t('stock.countsTitle')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/$storeId/stock/exports" params={{ storeId }}>
                {t('stock.exportsTitle')}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/$storeId/stock/imports" params={{ storeId }}>
                {t('stock.importsTitle')}
              </Link>
            </Button>
          </div>
        }
      />

      {!branchId ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('stock.kpiTotalQuantity')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary?.total_quantity.toLocaleString('vi-VN') ?? '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('stock.kpiItemsCount', { count: summary?.total_items ?? 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('stock.kpiTotalValue')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary ? fmtVnd(summary.total_value) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('stock.kpiTrackingSplit')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {summary
                    ? `${summary.tracked_count} / ${summary.untracked_count}`
                    : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('stock.kpiTrackingHint')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('stock.kpiAlerts')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  <span className="text-amber-600">{summary?.low_count ?? 0}</span>
                  {' · '}
                  <span className="text-destructive">{summary?.out_of_stock_count ?? 0}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t('stock.kpiAlertsHint')}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-56 flex-1">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('stock.searchPlaceholder')}
                    aria-label={t('stock.searchPlaceholder')}
                  />
                </div>
                <Select
                  value={itemKind}
                  onChange={(e) => setItemKind(e.target.value)}
                  aria-label={t('stock.filterItemKind')}
                >
                  <option value="all">{t('stock.allItemKinds')}</option>
                  <option value="product">{t('stock.itemKind_product')}</option>
                  <option value="ingredient">{t('stock.itemKind_ingredient')}</option>
                </Select>
                <Select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value)}
                  aria-label={t('stock.filterStockStatus')}
                >
                  <option value="all">{t('stock.allStatuses')}</option>
                  <option value="in_stock">{t('stock.status_in_stock')}</option>
                  <option value="low">{t('stock.status_low')}</option>
                  <option value="out_of_stock">{t('stock.status_out_of_stock')}</option>
                </Select>
                <Select
                  value={tracked}
                  onChange={(e) => setTracked(e.target.value)}
                  aria-label={t('stock.filterTracked')}
                >
                  <option value="all">{t('stock.trackedAll')}</option>
                  <option value="tracked">{t('stock.trackedOnly')}</option>
                  <option value="untracked">{t('stock.untrackedOnly')}</option>
                </Select>
              </div>

              {overview.isPending ? (
                <PageSkeleton />
              ) : overview.isError ? (
                <p role="alert" className="text-destructive">
                  {describeFailure(overview.error, t)}
                </p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('stock.empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">{t('stock.colSku')}</th>
                        <th className="py-2 pr-3">{t('stock.colName')}</th>
                        <th className="py-2 pr-3">{t('stock.colKind')}</th>
                        <th className="py-2 pr-3">{t('stock.colUnit')}</th>
                        <th className="py-2 pr-3 text-right">{t('stock.colCost')}</th>
                        <th className="py-2 pr-3 text-right">{t('stock.colOnHand')}</th>
                        <th className="py-2 pr-3 text-right">{t('stock.colValue')}</th>
                        <th className="py-2">{t('stock.colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((row) => (
                        <tr key={row.variant_id} className="hover:bg-muted/30">
                          <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                            {row.sku ?? '—'}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">
                            {[row.name, row.options_text].filter(Boolean).join(' · ')}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline">
                              {row.item_kind === 'ingredient'
                                ? t('stock.itemKind_ingredient')
                                : t('stock.itemKind_product')}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3">{row.base_unit}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {fmtVnd(row.cost_price)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                            {row.on_hand.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {fmtVnd(row.stock_value)}
                          </td>
                          <td className="py-2.5">
                            <Badge
                              variant={
                                row.stock_status === 'out_of_stock'
                                  ? 'destructive'
                                  : row.stock_status === 'low'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {t(`stock.status_${row.stock_status}`)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
