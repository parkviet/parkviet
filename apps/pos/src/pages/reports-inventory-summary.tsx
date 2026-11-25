import { PageHeader } from '@spree/dashboard-core'
import { Button, Card, Input } from '@spree/dashboard-ui'
import { DownloadIcon } from '@spree/dashboard-ui/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import {
  formatMoney,
  formatNumber,
  presetRange,
  ReportDateBar,
} from '../components/reports/analytics-ui'
import { Select } from '../components/topology-fields'
import { usePosSession } from '../hooks/use-pos-session'
import { useReportInventorySummary } from '../hooks/use-report-analytics'

export function ReportsInventorySummaryPage() {
  const { t } = useTranslation()
  const { context } = usePosSession()
  const branchId = context.data?.selection.branch_id ?? null

  const [range, setRange] = useState(() => presetRange('thisMonth'))
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [itemKind, setItemKind] = useState('all')

  const query = useReportInventorySummary(branchId, {
    from: range.from,
    to: range.to,
    q: q.trim() || undefined,
    status,
    item_kind: itemKind,
  })
  const rows = query.data?.data ?? []
  const totals = query.data?.meta.totals
  const currency = query.data?.meta.currency ?? context.data?.store.currency ?? 'VND'

  function exportCsv() {
    const header = [
      'Tên sản phẩm',
      'SKU',
      'Đơn vị tính',
      'Đầu kỳ SL',
      'Đầu kỳ Thành tiền',
      'Nhập SL',
      'Nhập Thành tiền',
      'Xuất SL',
      'Xuất Thành tiền',
      'Cuối kỳ SL',
      'Cuối kỳ Thành tiền',
    ]
    const csvRows = [
      header.join(','),
      ...rows.map((r) =>
        [
          `"${(r.name ?? '').replace(/"/g, '""')}"`,
          `"${(r.sku ?? '').replace(/"/g, '""')}"`,
          `"${(r.base_unit ?? '').replace(/"/g, '""')}"`,
          r.opening_qty,
          r.opening_value,
          r.inflow_qty,
          r.inflow_value,
          r.outflow_qty,
          r.outflow_value,
          r.closing_qty,
          r.closing_value,
        ].join(','),
      ),
    ]
    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tong-hop-ton-kho-${range.from}-${range.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.inventorySummaryTitle')}
        actions={
          <div className="flex items-center gap-2">
            <BranchPicker />
            <Button
              type="button"
              variant="outline"
              disabled={rows.length === 0}
              onClick={exportCsv}
            >
              <DownloadIcon className="size-4" />
              Tải CSV / Excel
            </Button>
          </div>
        }
      />
      {!branchId ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : (
        <div className="space-y-4">
          <ReportDateBar from={range.from} to={range.to} onChange={setRange} />

          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm sản phẩm, nguyên vật liệu theo tên, mã SKU..."
              className="max-w-sm"
            />
            <Select
              aria-label="Trạng thái kinh doanh"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-48"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang kinh doanh</option>
              <option value="draft">Ngừng kinh doanh</option>
            </Select>
            <Select
              aria-label="Loại hàng"
              value={itemKind}
              onChange={(e) => setItemKind(e.target.value)}
              className="w-44"
            >
              <option value="all">Tất cả loại hàng</option>
              <option value="product">Sản phẩm</option>
              <option value="ingredient">Nguyên vật liệu</option>
            </Select>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th rowSpan={2} className="border-r px-3 py-2 text-left">
                      Tên sản phẩm
                    </th>
                    <th rowSpan={2} className="border-r px-3 py-2 text-left">
                      ĐVT
                    </th>
                    <th colSpan={2} className="border-b border-r px-3 py-1.5 text-center">
                      Số dư đầu kỳ
                    </th>
                    <th colSpan={2} className="border-b border-r px-3 py-1.5 text-center">
                      Nhập trong kỳ
                    </th>
                    <th colSpan={2} className="border-b border-r px-3 py-1.5 text-center">
                      Xuất trong kỳ
                    </th>
                    <th colSpan={2} className="border-b px-3 py-1.5 text-center">
                      Tồn cuối kỳ
                    </th>
                  </tr>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                    <th className="px-2 py-1.5 text-right">SL</th>
                    <th className="border-r px-2 py-1.5 text-right">Thành tiền</th>
                    <th className="px-2 py-1.5 text-right">SL</th>
                    <th className="border-r px-2 py-1.5 text-right">Thành tiền</th>
                    <th className="px-2 py-1.5 text-right">SL</th>
                    <th className="border-r px-2 py-1.5 text-right">Thành tiền</th>
                    <th className="px-2 py-1.5 text-right">SL</th>
                    <th className="px-2 py-1.5 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {totals && (
                    <tr className="bg-muted/20 font-semibold">
                      <td className="border-r px-3 py-2.5" colSpan={2}>
                        Tổng cộng ({formatNumber(rows.length)} mặt hàng)
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {formatNumber(totals.opening_qty)}
                      </td>
                      <td className="border-r px-2 py-2.5 text-right tabular-nums">
                        {formatMoney(totals.opening_value, currency)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-emerald-600">
                        {formatNumber(totals.inflow_qty)}
                      </td>
                      <td className="border-r px-2 py-2.5 text-right tabular-nums text-emerald-600">
                        {formatMoney(totals.inflow_value, currency)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-rose-600">
                        {formatNumber(totals.outflow_qty)}
                      </td>
                      <td className="border-r px-2 py-2.5 text-right tabular-nums text-rose-600">
                        {formatMoney(totals.outflow_value, currency)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {formatNumber(totals.closing_qty)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {formatMoney(totals.closing_value, currency)}
                      </td>
                    </tr>
                  )}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-muted-foreground">
                        Không có mặt hàng nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.variant_id}>
                        <td className="border-r px-3 py-2.5">
                          <p className="font-medium">{row.name}</p>
                          {(row.sku || row.options_text) && (
                            <p className="text-xs text-muted-foreground">
                              {[row.sku, row.options_text].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="border-r px-3 py-2.5 text-muted-foreground">
                          {row.base_unit}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          {formatNumber(row.opening_qty)}
                        </td>
                        <td className="border-r px-2 py-2.5 text-right tabular-nums">
                          {formatMoney(row.opening_value, currency)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-emerald-600">
                          {formatNumber(row.inflow_qty)}
                        </td>
                        <td className="border-r px-2 py-2.5 text-right tabular-nums text-emerald-600">
                          {formatMoney(row.inflow_value, currency)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-rose-600">
                          {formatNumber(row.outflow_qty)}
                        </td>
                        <td className="border-r px-2 py-2.5 text-right tabular-nums text-rose-600">
                          {formatMoney(row.outflow_value, currency)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                          {formatNumber(row.closing_qty)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                          {formatMoney(row.closing_value, currency)}
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
