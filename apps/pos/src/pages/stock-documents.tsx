import { downloadCsv } from '@shared/finance'
import { describeFailure } from '@shared/request-failure'
import { PageHeader } from '@spree/dashboard-core'
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
} from '@spree/dashboard-ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { PageSkeleton } from '../components/page-skeleton'
import { type ProductHit, ProductSearch } from '../components/product-search'
import { Input, Select, TopologyField } from '../components/topology-fields'
import { useSuppliers } from '../hooks/use-partners'
import { usePosSession } from '../hooks/use-pos-session'
import {
  type StockDocument,
  type StockDocumentKind,
  useCancelStockDocument,
  useCompleteStockDocument,
  useCreateStockDocument,
  usePayStockDocument,
  useStockDocument,
  useStockDocuments,
  useStockOverview,
} from '../hooks/use-stock'

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
const fmtVnd = (raw: string | number) => vnd.format(Number(raw || 0))

type DraftLine = {
  variant_id: string
  name: string
  item_kind: 'product' | 'ingredient'
  quantity: string
  system_quantity: number
  actual_quantity: string
  unit_cost: string
}

export function StockDocumentsPage({ kind }: { kind: StockDocumentKind }) {
  const { t } = useTranslation()
  const { selection } = usePosSession()
  const branchId = selection.branchId

  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)

  // Form states
  const [supplierId, setSupplierId] = useState('')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [invoiceType, setInvoiceType] = useState('sales_invoice')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [exportReason, setExportReason] = useState('other')
  const [taxRate, setTaxRate] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [extraCost, setExtraCost] = useState('0')
  const [paidAmount, setPaidAmount] = useState('0')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [countTab, setCountTab] = useState<'all' | 'matched' | 'diff'>('all')
  const [payInput, setPayInput] = useState('')
  const [payMethod, setPayMethod] = useState('cash')

  const docs = useStockDocuments(branchId, {
    kind,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    payment_status: kind === 'import' && paymentFilter !== 'all' ? paymentFilter : undefined,
    supplier_id: kind === 'import' && supplierFilter !== 'all' ? supplierFilter : undefined,
    q: q.trim() || undefined,
  })
  const suppliers = useSuppliers({ status: 'active' })
  const overview = useStockOverview(branchId)
  const detail = useStockDocument(detailId)

  const createDoc = useCreateStockDocument()
  const completeDoc = useCompleteStockDocument()
  const cancelDoc = useCancelStockDocument()
  const payDoc = usePayStockDocument()

  const rows = docs.data?.data ?? []
  const stockByVariant = new Map((overview.data?.data ?? []).map((item) => [item.variant_id, item]))

  const titleKey =
    kind === 'import'
      ? 'stock.importsTitle'
      : kind === 'export'
        ? 'stock.exportsTitle'
        : kind === 'count'
          ? 'stock.countsTitle'
          : 'stock.openingTitle'

  const createLabelKey =
    kind === 'import'
      ? 'stock.createImport'
      : kind === 'export'
        ? 'stock.createExport'
        : kind === 'count'
          ? 'stock.createCount'
          : 'stock.createOpening'

  function resetForm() {
    setSupplierId('')
    setCounterpartyName('')
    setInvoiceType('sales_invoice')
    setInvoiceNumber('')
    setExportReason('other')
    setTaxRate('0')
    setDiscountAmount('0')
    setExtraCost('0')
    setPaidAmount('0')
    setNote('')
    setLines([])
    setCountTab('all')
  }

  function addHit(hit: ProductHit) {
    if (lines.some((l) => l.variant_id === hit.variantId)) return
    const info = stockByVariant.get(hit.variantId)
    const sysQty = info?.on_hand ?? 0
    setLines((prev) => [
      ...prev,
      {
        variant_id: hit.variantId,
        name: hit.name,
        item_kind: info?.item_kind ?? 'product',
        quantity: '1',
        system_quantity: sysQty,
        actual_quantity: String(sysQty),
        unit_cost: info?.cost_price ?? '0',
      },
    ])
  }

  function loadAllForCount() {
    const all = (overview.data?.data ?? []).map((item) => ({
      variant_id: item.variant_id,
      name: [item.name, item.options_text].filter(Boolean).join(' · '),
      item_kind: item.item_kind,
      quantity: '0',
      system_quantity: item.on_hand,
      actual_quantity: String(item.on_hand),
      unit_cost: item.cost_price,
    }))
    setLines(all)
  }

  function matchAllCounts() {
    setLines((prev) => prev.map((l) => ({ ...l, actual_quantity: String(l.system_quantity) })))
  }

  const subtotal = lines.reduce((sum, l) => {
    const qty =
      kind === 'count'
        ? Math.abs(Number(l.actual_quantity || 0) - l.system_quantity)
        : Number(l.quantity || 0)
    return sum + qty * Number(l.unit_cost || 0)
  }, 0)
  const taxable = Math.max(0, subtotal - Number(discountAmount || 0))
  const taxAmt = Math.round((taxable * Number(taxRate || 0)) / 100)
  const grandTotal = Math.max(0, taxable + taxAmt + Number(extraCost || 0))

  async function submit(completeNow: boolean) {
    if (!branchId || lines.length === 0) return
    setNotice(null)
    try {
      await createDoc.mutateAsync({
        branch_id: branchId,
        kind,
        supplier_id: supplierId || undefined,
        counterparty_name: counterpartyName.trim() || undefined,
        invoice_type: kind === 'import' ? invoiceType : undefined,
        invoice_number: kind === 'import' && invoiceNumber.trim() ? invoiceNumber.trim() : undefined,
        export_reason: kind === 'export' ? exportReason : undefined,
        tax_rate: kind === 'import' ? taxRate : '0',
        discount_amount: kind === 'import' ? discountAmount : '0',
        extra_cost: kind === 'import' ? extraCost : '0',
        paid_amount: kind === 'import' ? paidAmount : '0',
        note: note.trim() || undefined,
        complete_now: completeNow,
        lines: lines.map((l) => ({
          variant_id: l.variant_id,
          item_kind: l.item_kind,
          quantity: kind === 'count' ? 0 : Number(l.quantity || 0),
          actual_quantity: kind === 'count' ? Number(l.actual_quantity || 0) : undefined,
          unit_cost: l.unit_cost || '0',
        })),
      })
      setCreateOpen(false)
      resetForm()
      setNotice({ text: t('saved'), failed: false })
    } catch (err) {
      setNotice({ text: describeFailure(err, t), failed: true })
    }
  }

  function exportCsv() {
    downloadCsv(
      `phieu-kho-${kind}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Mã phiếu', 'Ngày', 'Đối tác', 'Trạng thái', 'Số dòng', 'Tổng tiền', 'Ghi chú'],
      rows.map((r: StockDocument) => [
        r.code,
        r.occurred_at,
        r.supplier_name ?? r.counterparty_name ?? '',
        t(`stock.docStatus_${r.status}`),
        r.items_count,
        r.total_amount,
        r.note ?? '',
      ]),
    )
  }

  const visibleDraftLines = lines.filter((l) => {
    if (kind !== 'count' || countTab === 'all') return true
    const diff = Number(l.actual_quantity || 0) - l.system_quantity
    return countTab === 'matched' ? diff === 0 : diff !== 0
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(titleKey)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              {t('stock.exportCsv')}
            </Button>
            <Button
              size="sm"
              disabled={!branchId}
              onClick={() => {
                resetForm()
                setCreateOpen(true)
              }}
            >
              {t(createLabelKey)}
            </Button>
          </div>
        }
      />

      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={notice.failed ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
        >
          {notice.text}
        </p>
      )}

      {kind === 'opening' && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4 text-sm text-amber-900 dark:text-amber-200">
            {t('stock.openingWarning')}
          </CardContent>
        </Card>
      )}

      {!branchId ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'draft', 'completed', 'canceled'] as const).map((st) => (
                <Button
                  key={st}
                  size="sm"
                  variant={statusFilter === st ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all' ? t('stock.allStatuses') : t(`stock.docStatus_${st}`)}
                </Button>
              ))}
              <div className="min-w-48 flex-1">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('stock.docSearchPlaceholder')}
                  aria-label={t('stock.docSearchPlaceholder')}
                />
              </div>
              {kind === 'import' && (
                <>
                  <Select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    aria-label={t('stock.filterPaymentStatus')}
                  >
                    <option value="all">{t('stock.allPayments')}</option>
                    <option value="unpaid">{t('stock.payStatus_unpaid')}</option>
                    <option value="partial">{t('stock.payStatus_partial')}</option>
                    <option value="paid">{t('stock.payStatus_paid')}</option>
                  </Select>
                  <Select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    aria-label={t('partners.suppliersTitle')}
                  >
                    <option value="all">{t('stock.allSuppliers')}</option>
                    {(suppliers.data?.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </>
              )}
            </div>

            {docs.isPending ? (
              <PageSkeleton />
            ) : docs.isError ? (
              <p role="alert" className="text-destructive">
                {describeFailure(docs.error, t)}
              </p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('stock.docsEmpty')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">{t('stock.colDocCode')}</th>
                      <th className="py-2 pr-3">{t('stock.colTime')}</th>
                      {kind === 'import' && (
                        <>
                          <th className="py-2 pr-3">{t('stock.colInvoiceType')}</th>
                          <th className="py-2 pr-3">{t('stock.colSupplier')}</th>
                        </>
                      )}
                      {kind === 'export' && <th className="py-2 pr-3">{t('stock.colRecipient')}</th>}
                      <th className="py-2 pr-3">{t('stock.colStatus')}</th>
                      {kind === 'count' ? (
                        <th className="py-2 pr-3 text-right">{t('stock.colVariance')}</th>
                      ) : (
                        <th className="py-2 pr-3 text-right">{t('stock.colTotal')}</th>
                      )}
                      {kind === 'import' && <th className="py-2 pr-3">{t('stock.colPayment')}</th>}
                      <th className="py-2 text-right">{t('stock.colAction')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((doc) => (
                      <tr key={doc.id} className="hover:bg-muted/30">
                        <td className="py-2.5 pr-3 font-mono font-medium">{doc.code}</td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground tabular-nums">
                          {new Date(doc.occurred_at).toLocaleString('vi-VN')}
                        </td>
                        {kind === 'import' && (
                          <>
                            <td className="py-2.5 pr-3 text-xs">
                              {doc.invoice_type
                                ? t(`stock.invoiceType_${doc.invoice_type}`, {
                                    defaultValue: doc.invoice_type,
                                  })
                                : '—'}
                            </td>
                            <td className="py-2.5 pr-3">{doc.supplier_name ?? '—'}</td>
                          </>
                        )}
                        {kind === 'export' && (
                          <td className="py-2.5 pr-3">{doc.counterparty_name ?? '—'}</td>
                        )}
                        <td className="py-2.5 pr-3">
                          <Badge
                            variant={
                              doc.status === 'completed'
                                ? 'default'
                                : doc.status === 'canceled'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {t(`stock.docStatus_${doc.status}`)}
                          </Badge>
                        </td>
                        {kind === 'count' ? (
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                            {doc.variance_quantity != null && doc.variance_quantity > 0
                              ? `+${doc.variance_quantity}`
                              : (doc.variance_quantity ?? 0)}
                          </td>
                        ) : (
                          <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                            {fmtVnd(doc.total_amount)}
                          </td>
                        )}
                        {kind === 'import' && (
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline">
                              {t(`stock.payStatus_${doc.payment_status}`)}
                            </Badge>
                          </td>
                        )}
                        <td className="py-2.5 text-right">
                          <Button size="sm" variant="outline" onClick={() => setDetailId(doc.id)}>
                            {t('stock.viewDetail')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t(createLabelKey)}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {kind === 'import' && (
                <>
                  <TopologyField label={t('stock.colSupplier')}>
                    {(id) => (
                      <Select id={id} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                        <option value="">{t('stock.selectSupplier')}</option>
                        {(suppliers.data?.data ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </Select>
                    )}
                  </TopologyField>
                  <TopologyField label={t('stock.colInvoiceType')}>
                    {(id) => (
                      <Select id={id} value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
                        <option value="vat_invoice">{t('stock.invoiceType_vat_invoice')}</option>
                        <option value="sales_invoice">{t('stock.invoiceType_sales_invoice')}</option>
                        <option value="purchase_statement">{t('stock.invoiceType_purchase_statement')}</option>
                        <option value="none">{t('stock.invoiceType_none')}</option>
                      </Select>
                    )}
                  </TopologyField>
                  <TopologyField label={t('stock.invoiceNumber')}>
                    {(id) => (
                      <Input
                        id={id}
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="VD: 0001234"
                      />
                    )}
                  </TopologyField>
                  <TopologyField label={t('stock.vatRate')}>
                    {(id) => (
                      <Select id={id} value={taxRate} onChange={(e) => setTaxRate(e.target.value)}>
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="8">8%</option>
                        <option value="10">10%</option>
                      </Select>
                    )}
                  </TopologyField>
                </>
              )}
              {kind === 'export' && (
                <>
                  <TopologyField label={t('stock.exportReason')}>
                    {(id) => (
                      <Select id={id} value={exportReason} onChange={(e) => setExportReason(e.target.value)}>
                        <option value="damage">{t('stock.exportReason_damage')}</option>
                        <option value="internal_use">{t('stock.exportReason_internal_use')}</option>
                        <option value="return_supplier">{t('stock.exportReason_return_supplier')}</option>
                        <option value="other">{t('stock.exportReason_other')}</option>
                      </Select>
                    )}
                  </TopologyField>
                  <TopologyField label={t('stock.colRecipient')}>
                    {(id) => (
                      <Input
                        id={id}
                        value={counterpartyName}
                        onChange={(e) => setCounterpartyName(e.target.value)}
                      />
                    )}
                  </TopologyField>
                </>
              )}
              <TopologyField label={t('stock.colNote')}>
                {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
              </TopologyField>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-64 flex-1">
                  <ProductSearch branchId={branchId} label={t('stock.addItem')} onPick={addHit} />
                </div>
                {kind === 'count' && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={loadAllForCount}>
                      {t('stock.loadAllItems')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={matchAllCounts}
                      disabled={lines.length === 0}
                    >
                      {t('stock.matchAllCounts')}
                    </Button>
                  </div>
                )}
              </div>

              {kind === 'count' && lines.length > 0 && (
                <div className="flex gap-2 pt-1">
                  {(['all', 'matched', 'diff'] as const).map((tab) => (
                    <Button
                      key={tab}
                      type="button"
                      size="sm"
                      variant={countTab === tab ? 'default' : 'outline'}
                      onClick={() => setCountTab(tab)}
                    >
                      {t(`stock.countTab_${tab}`)}
                    </Button>
                  ))}
                </div>
              )}

              {visibleDraftLines.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-2">{t('stock.colName')}</th>
                      {kind === 'count' ? (
                        <>
                          <th className="py-1.5 pr-2 text-right">{t('stock.systemQty')}</th>
                          <th className="py-1.5 pr-2 text-right">{t('stock.actualQty')}</th>
                          <th className="py-1.5 pr-2 text-right">{t('stock.colVariance')}</th>
                        </>
                      ) : (
                        <>
                          <th className="py-1.5 pr-2 text-right">{t('stock.colQty')}</th>
                          <th className="py-1.5 pr-2 text-right">{t('stock.colCost')}</th>
                        </>
                      )}
                      <th className="py-1.5 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleDraftLines.map((line) => {
                      const diff = Number(line.actual_quantity || 0) - line.system_quantity
                      return (
                        <tr key={line.variant_id}>
                          <td className="py-2 pr-2 font-medium">{line.name}</td>
                          {kind === 'count' ? (
                            <>
                              <td className="py-2 pr-2 text-right tabular-nums">
                                {line.system_quantity}
                              </td>
                              <td className="w-28 py-2 pr-2">
                                <Input
                                  type="number"
                                  value={line.actual_quantity}
                                  onChange={(e) =>
                                    setLines((prev) =>
                                      prev.map((l) =>
                                        l.variant_id === line.variant_id
                                          ? { ...l, actual_quantity: e.target.value }
                                          : l,
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td
                                className={`py-2 pr-2 text-right font-semibold tabular-nums ${
                                  diff > 0
                                    ? 'text-emerald-600'
                                    : diff < 0
                                      ? 'text-destructive'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="w-24 py-2 pr-2">
                                <Input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={(e) =>
                                    setLines((prev) =>
                                      prev.map((l) =>
                                        l.variant_id === line.variant_id
                                          ? { ...l, quantity: e.target.value }
                                          : l,
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td className="w-36 py-2 pr-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={line.unit_cost}
                                  onChange={(e) =>
                                    setLines((prev) =>
                                      prev.map((l) =>
                                        l.variant_id === line.variant_id
                                          ? { ...l, unit_cost: e.target.value }
                                          : l,
                                      ),
                                    )
                                  }
                                />
                              </td>
                            </>
                          )}
                          <td className="py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setLines((prev) => prev.filter((l) => l.variant_id !== line.variant_id))
                              }
                            >
                              ×
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {kind === 'import' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <TopologyField label={t('stock.discount')}>
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                    />
                  )}
                </TopologyField>
                <TopologyField label={t('stock.extraCost')}>
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      value={extraCost}
                      onChange={(e) => setExtraCost(e.target.value)}
                    />
                  )}
                </TopologyField>
                <TopologyField label={t('stock.paidNow')}>
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                    />
                  )}
                </TopologyField>
              </div>
            )}

          </DialogBody>
          <DialogFooter className="sm:justify-between">
            <div className="text-sm font-semibold tabular-nums">
              {t('stock.colTotal')}: {fmtVnd(grandTotal)}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t('adminCancel')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={lines.length === 0 || createDoc.isPending}
                onClick={() => void submit(false)}
              >
                {t('stock.saveDraft')}
              </Button>
              <Button
                type="button"
                disabled={lines.length === 0 || createDoc.isPending}
                onClick={() => void submit(true)}
              >
                {t('stock.saveAndComplete')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90dvh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {detail.data ? `${detail.data.code} · ${t(`stock.docStatus_${detail.data.status}`)}` : '...'}
            </DialogTitle>
          </DialogHeader>
          {detail.isPending ? (
            <DialogBody>
              <PageSkeleton />
            </DialogBody>
          ) : detail.data ? (
            <>
              <DialogBody className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t('stock.colTime')}: </span>
                  {new Date(detail.data.occurred_at).toLocaleString('vi-VN')}
                </div>
                {detail.data.supplier_name && (
                  <div>
                    <span className="text-muted-foreground">{t('stock.colSupplier')}: </span>
                    {detail.data.supplier_name}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t('stock.colTotal')}: </span>
                  <strong>{fmtVnd(detail.data.total_amount)}</strong>
                </div>
                {detail.data.kind === 'import' && (
                  <div>
                    <span className="text-muted-foreground">{t('stock.paidAmount')}: </span>
                    <strong>{fmtVnd(detail.data.paid_amount)}</strong> (
                    {t(`stock.payStatus_${detail.data.payment_status}`)})
                  </div>
                )}
              </div>

              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-2">{t('stock.colName')}</th>
                    <th className="py-1.5 pr-2 text-right">{t('stock.colQty')}</th>
                    <th className="py-1.5 pr-2 text-right">{t('stock.colCost')}</th>
                    <th className="py-1.5 text-right">{t('stock.colTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(detail.data.lines ?? []).map((line) => (
                    <tr key={line.id}>
                      <td className="py-2 pr-2">{line.name}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmtVnd(line.unit_cost)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtVnd(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {detail.data.kind === 'import' &&
                detail.data.status !== 'canceled' &&
                detail.data.payment_status !== 'paid' && (
                  <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                    <div className="w-40">
                      <TopologyField label={t('stock.recordPaymentAmount')}>
                        {(id) => (
                          <Input
                            id={id}
                            type="number"
                            min="1"
                            value={payInput}
                            onChange={(e) => setPayInput(e.target.value)}
                          />
                        )}
                      </TopologyField>
                    </div>
                    <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="cash">{t('partners.payMethod_cash')}</option>
                      <option value="bank">{t('partners.payMethod_bank')}</option>
                      <option value="ewallet">{t('partners.payMethod_ewallet')}</option>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!payInput || Number(payInput) <= 0 || payDoc.isPending}
                      onClick={async () => {
                        if (!detail.data) return
                        await payDoc.mutateAsync({
                          id: detail.data.id,
                          amount: payInput,
                          payment_method: payMethod,
                        })
                        setPayInput('')
                      }}
                    >
                      {t('stock.payNow')}
                    </Button>
                  </div>
                )}

              </DialogBody>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  {t('stock.printDoc')}
                </Button>
                {detail.data.status === 'draft' && (
                  <Button
                    size="sm"
                    disabled={completeDoc.isPending}
                    onClick={() => void completeDoc.mutateAsync(detail.data!.id)}
                  >
                    {t('stock.saveAndComplete')}
                  </Button>
                )}
                {detail.data.status !== 'canceled' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={cancelDoc.isPending}
                    onClick={() => void cancelDoc.mutateAsync({ id: detail.data!.id })}
                  >
                    {t('stock.cancelDoc')}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
