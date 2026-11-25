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
import { PageSkeleton } from '../components/page-skeleton'
import { Input, Select, TopologyField } from '../components/topology-fields'
import {
  type PartnerCustomer,
  useCreatePartnerCustomer,
  useCreatePartnerGroup,
  useDeletePartnerGroup,
  usePartnerCustomerDetail,
  usePartnerCustomers,
  usePartnerGroups,
  useUpdatePartnerCustomer,
} from '../hooks/use-partners'

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
const fmtVnd = (raw: string | number) => vnd.format(Number(raw || 0))

export function PartnersCustomersPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'list' | 'groups'>('list')
  const [q, setQ] = useState('')
  const [debtFilter, setDebtFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('recent')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PartnerCustomer | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)

  // Customer form fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [partnerGroupId, setPartnerGroupId] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [invoiceCompany, setInvoiceCompany] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [alsoSupplier, setAlsoSupplier] = useState(false)
  const [note, setNote] = useState('')

  // Group form
  const [newGroupName, setNewGroupName] = useState('')

  const customers = usePartnerCustomers({
    q: q.trim() || undefined,
    debt_filter: debtFilter !== 'all' ? debtFilter : undefined,
    partner_group_id: groupFilter !== 'all' ? groupFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    sort,
  })
  const groups = usePartnerGroups('customer')
  const detail = usePartnerCustomerDetail(detailId)

  const createCustomer = useCreatePartnerCustomer()
  const updateCustomer = useUpdatePartnerCustomer()
  const createGroup = useCreatePartnerGroup('customer')
  const deleteGroup = useDeletePartnerGroup('customer')

  const rows = customers.data?.data ?? []
  const summary = customers.data?.meta.summary

  function openCreate() {
    setEditing(null)
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setPartnerGroupId('')
    setTaxCode('')
    setInvoiceCompany('')
    setTagsText('')
    setAlsoSupplier(false)
    setNote('')
    setFormOpen(true)
  }

  function openEdit(c: PartnerCustomer) {
    setEditing(c)
    setName(c.name)
    setPhone(c.phone ?? '')
    setEmail(c.email ?? '')
    setAddress(c.address ?? '')
    setPartnerGroupId(c.partner_group_id ?? '')
    setTaxCode(c.tax_code ?? '')
    setInvoiceCompany(c.invoice_company ?? '')
    setTagsText(c.tags.join(', '))
    setAlsoSupplier(c.also_supplier)
    setNote(c.note ?? '')
    setFormOpen(true)
  }

  async function saveCustomer() {
    setNotice(null)
    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      partner_group_id: partnerGroupId || null,
      tax_code: taxCode.trim() || undefined,
      invoice_company: invoiceCompany.trim() || undefined,
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      also_supplier: alsoSupplier,
      note: note.trim() || undefined,
    }
    try {
      if (editing) {
        await updateCustomer.mutateAsync({ id: editing.id, ...payload })
      } else {
        await createCustomer.mutateAsync(payload)
      }
      setFormOpen(false)
      setNotice({ text: t('saved'), failed: false })
    } catch (err) {
      setNotice({ text: describeFailure(err, t), failed: true })
    }
  }

  function exportCsv() {
    downloadCsv(
      `khach-hang-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Mã KH', 'Tên khách hàng', 'SĐT', 'Email', 'Nhóm', 'Mã số thuế', 'Phải thu', 'Trạng thái'],
      rows.map((c) => [
        c.code ?? '',
        c.name,
        c.phone ?? '',
        c.email ?? '',
        c.partner_group_name ?? '',
        c.tax_code ?? '',
        c.receivable_balance,
        c.status,
      ]),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('partners.customersTitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              {t('stock.exportCsv')}
            </Button>
            <Button size="sm" onClick={openCreate}>
              {t('partners.createCustomer')}
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
          {t('partners.customersTitle')}
        </Button>
        <Button size="sm" variant={tab === 'groups' ? 'default' : 'outline'} onClick={() => setTab('groups')}>
          {t('partners.customerGroupsTitle')}
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
                      placeholder="VD: Khách VIP, Khách sỉ..."
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('partners.kpiTotalCustomers')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary?.total_customers ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('partners.kpiActiveCustomers')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary?.active_count ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('partners.kpiTotalReceivable')}</p>
                <p className="mt-1 text-2xl font-semibold text-amber-600 tabular-nums">
                  {summary ? fmtVnd(summary.total_receivable) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t('partners.kpiDebtorsCount')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary?.debtors_count ?? 0}
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
                  variant={debtFilter === 'customer_owes' ? 'default' : 'outline'}
                  onClick={() => setDebtFilter('customer_owes')}
                >
                  {t('partners.filterCustomerOwes')}
                </Button>
                <div className="min-w-52 flex-1">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('partners.searchCustomer')}
                    aria-label={t('partners.searchCustomer')}
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
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">{t('stock.allStatuses')}</option>
                  <option value="active">{t('partners.statusActive')}</option>
                  <option value="inactive">{t('partners.statusInactive')}</option>
                </Select>
                <Select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent">{t('partners.sortRecent')}</option>
                  <option value="name_asc">{t('partners.sortNameAsc')}</option>
                  <option value="debt_desc">{t('partners.sortDebtDesc')}</option>
                </Select>
              </div>

              {customers.isPending ? (
                <PageSkeleton />
              ) : customers.isError ? (
                <p role="alert" className="text-destructive">
                  {describeFailure(customers.error, t)}
                </p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('partners.customersEmpty')}
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
                        <th className="py-2 pr-3 text-right">{t('partners.colReceivable')}</th>
                        <th className="py-2 pr-3">{t('partners.colTags')}</th>
                        <th className="py-2 text-right">{t('stock.colAction')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                            {c.code ?? '—'}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={() => setDetailId(c.id)}
                            >
                              {c.name}
                            </button>
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums">{c.phone ?? '—'}</td>
                          <td className="py-2.5 pr-3 text-xs">{c.partner_group_name ?? '—'}</td>
                          <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                            {fmtVnd(c.receivable_balance)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {c.tags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 text-right">
                            <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                              {t('adminEdit')}
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
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('partners.editCustomer') : t('partners.createCustomer')}
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
            <TopologyField label={t('partners.tagsHint')}>
              {(id) => (
                <Input id={id} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
              )}
            </TopologyField>
            <TopologyField label={t('stock.colNote')}>
              {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
            </TopologyField>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={alsoSupplier}
                onChange={(e) => setAlsoSupplier(e.target.checked)}
              />
              {t('partners.alsoSupplier')}
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t('adminCancel')}
            </Button>
            <Button
              disabled={!name.trim() || (!phone.trim() && !email.trim())}
              onClick={() => void saveCustomer()}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90dvh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail.data?.name ?? '...'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {detail.isPending ? (
              <PageSkeleton />
            ) : detail.data ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">{t('partners.colCode')}: </span>
                    {detail.data.code ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('partners.colPhone')}: </span>
                    {detail.data.phone ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('partners.taxCode')}: </span>
                    {detail.data.tax_code ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('partners.colReceivable')}: </span>
                    <strong>{fmtVnd(detail.data.receivable_balance)}</strong>
                  </div>
                </div>
                {detail.data.recent_receivables.length > 0 && (
                  <div>
                    <p className="mb-2 font-medium">{t('partners.recentDebtHistory')}</p>
                    <ul className="divide-y rounded-md border">
                      {detail.data.recent_receivables.map((e) => (
                        <li key={e.id} className="flex justify-between px-3 py-2 text-xs">
                          <span>{e.note || e.kind}</span>
                          <span className="font-semibold tabular-nums">{fmtVnd(e.amount)}</span>
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
