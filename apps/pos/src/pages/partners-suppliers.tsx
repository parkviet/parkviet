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
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import { Input, Select, TopologyField } from '../components/topology-fields'
import {
  type PosSupplier,
  useCreatePartnerGroup,
  useCreateSupplier,
  useDeletePartnerGroup,
  usePartnerGroups,
  useRecordSupplierPayment,
  useSupplierDetail,
  useSuppliers,
  useUpdateSupplier,
} from '../hooks/use-partners'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
const fmtVnd = (raw: string | number) => vnd.format(Number(raw || 0))

export function PartnersSuppliersPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { selection } = usePosSession()
  const branchId = selection.branchId

  const [tab, setTab] = useState<'list' | 'groups'>('list')
  const [q, setQ] = useState('')
  const [debtFilter, setDebtFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sort, setSort] = useState('recent')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PosSupplier | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)

  // Supplier form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [partnerGroupId, setPartnerGroupId] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [invoiceCompany, setInvoiceCompany] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [openingPayable, setOpeningPayable] = useState('0')
  const [tagsText, setTagsText] = useState('')
  const [alsoCustomer, setAlsoCustomer] = useState(false)
  const [note, setNote] = useState('')

  // Group & payment form
  const [newGroupName, setNewGroupName] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('bank')
  const [payNote, setPayNote] = useState('')

  const suppliers = useSuppliers({
    q: q.trim() || undefined,
    debt_filter: debtFilter !== 'all' ? debtFilter : undefined,
    partner_group_id: groupFilter !== 'all' ? groupFilter : undefined,
    sort,
  })
  const groups = usePartnerGroups('supplier')
  const detail = useSupplierDetail(detailId)

  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()
  const recordPayment = useRecordSupplierPayment()
  const createGroup = useCreatePartnerGroup('supplier')
  const deleteGroup = useDeletePartnerGroup('supplier')

  const rows = suppliers.data?.data ?? []
  const summary = suppliers.data?.meta.summary

  function openCreate() {
    setEditing(null)
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setPartnerGroupId('')
    setTaxCode('')
    setInvoiceCompany('')
    setBankName('')
    setBankAccount('')
    setOpeningPayable('0')
    setTagsText('')
    setAlsoCustomer(false)
    setNote('')
    setFormOpen(true)
  }

  function openEdit(s: PosSupplier) {
    setEditing(s)
    setName(s.name)
    setPhone(s.phone ?? '')
    setEmail(s.email ?? '')
    setAddress(s.address ?? '')
    setPartnerGroupId(s.partner_group_id ?? '')
    setTaxCode(s.tax_code ?? '')
    setInvoiceCompany(s.invoice_company ?? '')
    setBankName(s.bank_name ?? '')
    setBankAccount(s.bank_account ?? '')
    setOpeningPayable(s.opening_payable)
    setTagsText(s.tags.join(', '))
    setAlsoCustomer(s.also_customer)
    setNote(s.note ?? '')
    setFormOpen(true)
  }

  async function saveSupplier() {
    setNotice(null)
    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      partner_group_id: partnerGroupId || null,
      tax_code: taxCode.trim() || undefined,
      invoice_company: invoiceCompany.trim() || undefined,
      bank_name: bankName.trim() || undefined,
      bank_account: bankAccount.trim() || undefined,
      opening_payable: openingPayable || '0',
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      also_customer: alsoCustomer,
      note: note.trim() || undefined,
    }
    try {
      if (editing) {
        await updateSupplier.mutateAsync({ id: editing.id, ...payload })
      } else {
        await createSupplier.mutateAsync(payload)
      }
      setFormOpen(false)
      setNotice({ text: t('saved'), failed: false })
    } catch (err) {
      setNotice({ text: describeFailure(err, t), failed: true })
    }
  }

  function exportCsv() {
    downloadCsv(
      `nha-cung-cap-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Mã NCC', 'Tên NCC', 'SĐT', 'Nhóm', 'Mã số thuế', 'Đã nhập', 'Phải trả NCC'],
      rows.map((s) => [
        s.code,
        s.name,
        s.phone ?? '',
        s.partner_group_name ?? '',
        s.tax_code ?? '',
        s.imported_total,
        s.payable_balance,
      ]),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('partners.suppliersTitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              {t('stock.exportCsv')}
            </Button>
            <Button size="sm" onClick={openCreate}>
              {t('partners.createSupplier')}
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

      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'list' ? 'default' : 'outline'} onClick={() => setTab('list')}>
          {t('partners.suppliersTitle')}
        </Button>
        <Button size="sm" variant={tab === 'groups' ? 'default' : 'outline'} onClick={() => setTab('groups')}>
          {t('partners.supplierGroupsTitle')}
        </Button>
      </div>

      {tab === 'groups' ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-60 flex-1">
                <TopologyField label={t('partners.groupName')}>
                  {(id) => (
                    <Input
                      id={id}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="VD: NCC Đồ uống, NCC Thực phẩm..."
                    />
                  )}
                </TopologyField>
              </div>
              <Button
                disabled={!newGroupName.trim() || createGroup.isPending}
                onClick={async () => {
                  await createGroup.mutateAsync({ name: newGroupName.trim() })
                  setNewGroupName('')
                }}
              >
                {t('partners.createGroup')}
              </Button>
            </div>
            {(groups.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('partners.groupsEmpty')}</p>
            ) : (
              <ul className="divide-y">
                {(groups.data ?? []).map((g) => (
                  <li key={g.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{g.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({g.members_count ?? 0} {t('partners.members')})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void deleteGroup.mutateAsync(g.id)}
                    >
                      {t('partners.delete')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('partners.kpiTotalSuppliers')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary?.total_suppliers ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('partners.kpiTotalImports')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary?.total_imports ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {summary ? fmtVnd(summary.total_imported_value) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('partners.kpiTotalPayable')}</p>
                <p className="mt-1 text-2xl font-semibold text-destructive tabular-nums">
                  {summary ? fmtVnd(summary.total_payable) : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={debtFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setDebtFilter('all')}
                >
                  {t('stock.allStatuses')}
                </Button>
                <Button
                  size="sm"
                  variant={debtFilter === 'shop_owes' ? 'default' : 'outline'}
                  onClick={() => setDebtFilter('shop_owes')}
                >
                  {t('partners.filterShopOwes')}
                </Button>
                <Button
                  size="sm"
                  variant={debtFilter === 'supplier_owes' ? 'default' : 'outline'}
                  onClick={() => setDebtFilter('supplier_owes')}
                >
                  {t('partners.filterSupplierOwes')}
                </Button>
                <div className="min-w-52 flex-1">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('partners.searchSupplier')}
                    aria-label={t('partners.searchSupplier')}
                  />
                </div>
                <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                  <option value="all">{t('partners.allGroups')}</option>
                  {(groups.data ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
                <Select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent">{t('partners.sortRecent')}</option>
                  <option value="name_asc">{t('partners.sortNameAsc')}</option>
                  <option value="imported_desc">{t('partners.sortImportedDesc')}</option>
                  <option value="payable_desc">{t('partners.sortPayableDesc')}</option>
                </Select>
              </div>

              {suppliers.isPending ? (
                <PageSkeleton />
              ) : suppliers.isError ? (
                <p role="alert" className="text-destructive">
                  {describeFailure(suppliers.error, t)}
                </p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('partners.suppliersEmpty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">{t('partners.colCode')}</th>
                        <th className="py-2 pr-3">{t('partners.colName')}</th>
                        <th className="py-2 pr-3">{t('partners.colPhone')}</th>
                        <th className="py-2 pr-3">{t('partners.colGroup')}</th>
                        <th className="py-2 pr-3 text-right">{t('partners.colImported')}</th>
                        <th className="py-2 pr-3 text-right">{t('partners.colPayable')}</th>
                        <th className="py-2 text-right">{t('stock.colAction')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                            {s.code}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={() => setDetailId(s.id)}
                            >
                              {s.name}
                            </button>
                            {s.tags.length > 0 && (
                              <span className="ml-2 inline-flex gap-1">
                                {s.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary">
                                    {tag}
                                  </Badge>
                                ))}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums">{s.phone ?? '—'}</td>
                          <td className="py-2.5 pr-3 text-xs">{s.partner_group_name ?? '—'}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {fmtVnd(s.imported_total)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                            {fmtVnd(s.payable_balance)}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button asChild size="sm" variant="outline">
                                <Link to="/$storeId/stock/imports" params={{ storeId }}>
                                  {t('stock.importsTitle')}
                                </Link>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                                {t('adminEdit')}
                              </Button>
                            </div>
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

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('partners.editSupplier') : t('partners.createSupplier')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <TopologyField label={t('partners.colName')}>
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </TopologyField>
            <TopologyField label={t('partners.colPhone')}>
              {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}
            </TopologyField>
            <TopologyField label="Email">
              {(id) => <Input id={id} value={email} onChange={(e) => setEmail(e.target.value)} />}
            </TopologyField>
            <TopologyField label={t('partners.colGroup')}>
              {(id) => (
                <Select
                  id={id}
                  value={partnerGroupId}
                  onChange={(e) => setPartnerGroupId(e.target.value)}
                >
                  <option value="">—</option>
                  {(groups.data ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              )}
            </TopologyField>
            <div className="sm:col-span-2">
              <TopologyField label={t('partners.address')}>
                {(id) => (
                  <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} />
                )}
              </TopologyField>
            </div>
            <TopologyField label={t('partners.taxCode')}>
              {(id) => (
                <Input id={id} value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
              )}
            </TopologyField>
            <TopologyField label={t('partners.invoiceCompany')}>
              {(id) => (
                <Input
                  id={id}
                  value={invoiceCompany}
                  onChange={(e) => setInvoiceCompany(e.target.value)}
                />
              )}
            </TopologyField>
            <TopologyField label={t('partners.bankName')}>
              {(id) => (
                <Input id={id} value={bankName} onChange={(e) => setBankName(e.target.value)} />
              )}
            </TopologyField>
            <TopologyField label={t('partners.bankAccount')}>
              {(id) => (
                <Input
                  id={id}
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                />
              )}
            </TopologyField>
            <TopologyField label={t('partners.openingPayable')}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  value={openingPayable}
                  onChange={(e) => setOpeningPayable(e.target.value)}
                />
              )}
            </TopologyField>
            <TopologyField label={t('partners.tagsHint')}>
              {(id) => (
                <Input id={id} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
              )}
            </TopologyField>
            <div className="sm:col-span-2">
              <TopologyField label={t('stock.colNote')}>
                {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
              </TopologyField>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={alsoCustomer}
                onChange={(e) => setAlsoCustomer(e.target.checked)}
              />
              {t('partners.alsoCustomer')}
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t('adminCancel')}
            </Button>
            <Button disabled={!name.trim()} onClick={() => void saveSupplier()}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Detail + Record Payment Dialog */}
      <Dialog open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90dvh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {detail.data ? `${detail.data.name} (${detail.data.code})` : '...'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {detail.isPending ? (
              <PageSkeleton />
            ) : detail.data ? (
              <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">{t('partners.colImported')}: </span>
                  <strong>{fmtVnd(detail.data.imported_total)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('partners.colPaid')}: </span>
                  <strong>{fmtVnd(detail.data.paid_total)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('partners.colPayable')}: </span>
                  <strong className="text-destructive">{fmtVnd(detail.data.payable_balance)}</strong>
                </div>
              </div>

              {branchId && (
                <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                  <div className="w-40">
                    <TopologyField label={t('partners.paySupplierAmount')}>
                      {(id) => (
                        <Input
                          id={id}
                          type="number"
                          min="1"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                        />
                      )}
                    </TopologyField>
                  </div>
                  <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="cash">{t('partners.payMethod_cash')}</option>
                    <option value="bank">{t('partners.payMethod_bank')}</option>
                    <option value="ewallet">{t('partners.payMethod_ewallet')}</option>
                  </Select>
                  <div className="min-w-40 flex-1">
                    <TopologyField label={t('stock.colNote')}>
                      {(id) => (
                        <Input
                          id={id}
                          value={payNote}
                          onChange={(e) => setPayNote(e.target.value)}
                        />
                      )}
                    </TopologyField>
                  </div>
                  <Button
                    size="sm"
                    disabled={!payAmount || Number(payAmount) <= 0 || recordPayment.isPending}
                    onClick={async () => {
                      if (!detail.data || !branchId) return
                      await recordPayment.mutateAsync({
                        supplierId: detail.data.id,
                        branch_id: branchId,
                        amount: payAmount,
                        payment_method: payMethod,
                        note: payNote.trim() || undefined,
                      })
                      setPayAmount('')
                      setPayNote('')
                    }}
                  >
                    {t('partners.recordPayment')}
                  </Button>
                </div>
              )}

              {detail.data.imports.length > 0 && (
                <div>
                  <p className="mb-1.5 font-medium">{t('partners.importHistory')}</p>
                  <ul className="divide-y rounded-md border">
                    {detail.data.imports.map((doc) => (
                      <li key={doc.id} className="flex justify-between px-3 py-2 text-xs">
                        <span>
                          <strong>{doc.code}</strong> ·{' '}
                          {new Date(doc.occurred_at).toLocaleDateString('vi-VN')}
                        </span>
                        <span className="tabular-nums">
                          {fmtVnd(doc.total_amount)} ({t(`stock.payStatus_${doc.payment_status}`)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.data.payments.length > 0 && (
                <div>
                  <p className="mb-1.5 font-medium">{t('partners.paymentHistory')}</p>
                  <ul className="divide-y rounded-md border">
                    {detail.data.payments.map((p) => (
                      <li key={p.id} className="flex justify-between px-3 py-2 text-xs">
                        <span>
                          {new Date(p.occurred_at).toLocaleDateString('vi-VN')} ·{' '}
                          {t(`partners.payMethod_${p.payment_method}`)}
                          {p.note ? ` · ${p.note}` : ''}
                        </span>
                        <span className="font-semibold text-emerald-600 tabular-nums">
                          {fmtVnd(p.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailId(null)}>
              {t('adminClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
