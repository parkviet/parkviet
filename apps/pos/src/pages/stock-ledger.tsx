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
import { type StockLedgerRow, useStockLedger } from '../hooks/use-stock'

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
const fmtVnd = (raw: string | number) => vnd.format(Number(raw || 0))

export function StockLedgerPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { selection } = usePosSession()
  const branchId = selection.branchId

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [itemKind, setItemKind] = useState('all')
  const [movementKind, setMovementKind] = useState('all')

  const ledger = useStockLedger(branchId, {
    from: from || undefined,
    to: to || undefined,
    q: q.trim() || undefined,
    item_kind: itemKind !== 'all' ? itemKind : undefined,
    movement_kind: movementKind !== 'all' ? movementKind : undefined,
  })

  const summary = ledger.data?.meta.summary
  const rows = ledger.data?.data ?? []

  function exportCsv() {
    downloadCsv(
      `so-kho-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Thời gian', 'Mã phiếu', 'SKU', 'Sản phẩm', 'Phân loại', 'ĐVT', 'Số lượng', 'Giá vốn', 'Giá trị', 'Ghi chú'],
      rows.map((r: StockLedgerRow) => [
        r.occurred_at,
        r.reference_code ?? '',
        r.sku ?? '',
        r.name,
        r.movement_kind,
        r.base_unit,
        r.quantity,
        r.unit_cost,
        r.value,
        r.reason ?? '',
      ]),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stock.ledgerTitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              {t('stock.exportCsv')}
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
                <p className="text-xs text-muted-foreground">{t('stock.ledgerOpening')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {summary ? fmtVnd(summary.opening_value) : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  SL: {summary?.opening_qty ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('stock.ledgerInflow')}</p>
                <p className="mt-1 text-xl font-semibold text-emerald-600 tabular-nums">
                  + {summary ? fmtVnd(summary.inflow_value) : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  +{summary?.inflow_qty ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('stock.ledgerOutflow')}</p>
                <p className="mt-1 text-xl font-semibold text-destructive tabular-nums">
                  − {summary ? fmtVnd(summary.outflow_value) : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  −{summary?.outflow_qty ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('stock.ledgerClosing')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  = {summary ? fmtVnd(summary.closing_value) : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  SL: {summary?.closing_qty ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('stock.ledgerSearch')}
                    aria-label={t('stock.ledgerSearch')}
                  />
                </div>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label={t('stock.fromDate')}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label={t('stock.toDate')}
                  className="w-40"
                />
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
                  value={movementKind}
                  onChange={(e) => setMovementKind(e.target.value)}
                  aria-label={t('stock.filterMovementKind')}
                >
                  <option value="all">{t('stock.allMovements')}</option>
                  <option value="pos_import">{t('stock.mv_pos_import')}</option>
                  <option value="pos_export">{t('stock.mv_pos_export')}</option>
                  <option value="pos_count">{t('stock.mv_pos_count')}</option>
                  <option value="pos_opening">{t('stock.mv_pos_opening')}</option>
                </Select>
              </div>

              {ledger.isPending ? (
                <PageSkeleton />
              ) : ledger.isError ? (
                <p role="alert" className="text-destructive">
                  {describeFailure(ledger.error, t)}
                </p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('stock.ledgerEmpty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">{t('stock.colTime')}</th>
                        <th className="py-2 pr-3">{t('stock.colDocCode')}</th>
                        <th className="py-2 pr-3">{t('stock.colName')}</th>
                        <th className="py-2 pr-3">{t('stock.colMovement')}</th>
                        <th className="py-2 pr-3">{t('stock.colUnit')}</th>
                        <th className="py-2 pr-3 text-right">{t('stock.colQty')}</th>
                        <th className="py-2 pr-3 text-right">{t('stock.colValue')}</th>
                        <th className="py-2">{t('stock.colNote')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="py-2.5 pr-3 text-xs text-muted-foreground tabular-nums">
                            {new Date(row.occurred_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-xs">
                            {row.reference_code ?? '—'}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">
                            {row.name}
                            {row.sku && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {row.sku}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline">
                              {t(`stock.mv_${row.movement_kind}`, { defaultValue: row.movement_kind })}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3">{row.base_unit}</td>
                          <td
                            className={`py-2.5 pr-3 text-right font-semibold tabular-nums ${
                              row.quantity >= 0 ? 'text-emerald-600' : 'text-destructive'
                            }`}
                          >
                            {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {fmtVnd(row.value)}
                          </td>
                          <td className="py-2.5 text-xs text-muted-foreground">
                            {row.reason ?? '—'}
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
