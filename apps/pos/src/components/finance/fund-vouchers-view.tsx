import {
  DATE_PRESETS,
  type DatePreset,
  datePresetRange,
  downloadCsv,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  vndToWords,
} from '@shared/finance'
import { formatMoney, parseVndInput } from '@shared/money'
import { writesLocked } from '@shared/pos-context'
import { describeFailure } from '@shared/request-failure'
import type {
  PosFundAccount,
  PosFundVoucher,
  PosFundVoucherSummary,
} from '@shared/types/pos-context'
import { defineTable, ResourceTable, usePermissions } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ResourceNameCell,
  RowActions,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useRowClickBridge,
} from '@spree/dashboard-ui'
import { DownloadIcon, PlusIcon, PrinterIcon, RotateCcwIcon } from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { type FormEvent, useCallback, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchFundVouchers,
  useCreateFundVoucher,
  useFundAccounts,
  useVoidFundVoucher,
} from '../../hooks/use-finance'
import { usePosSession } from '../../hooks/use-pos-session'
import { useSession } from '../../hooks/use-session'
import { branchTimeZone, formatInstant } from '../../lib/format-time'
import { canAdminister, hasCapability } from '../../lib/pos-access'
import { fundsSearchSchema } from '../../schemas/list-search'
import { hiddenTimestamps } from '../../tables/columns'
import { FilterSelect } from '../filter-select'

const ALL_CATS = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, 'internal_transfer'] as const

export function FundVouchersView({ branchId }: { branchId: string }) {
  const { t, i18n } = useTranslation()
  const { storeId } = useSession()
  const { permissionKeys } = usePermissions()
  const { context, selection } = usePosSession()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = fundsSearchSchema.parse(useSearch({ strict: false }))
  const timeZone = branchTimeZone(context.data)
  const currency = context.data?.store.currency ?? 'VND'
  const canWrite =
    hasCapability({ permissionKeys, context: context.data }, 'pos.payment.resolve') ||
    canAdminister({ permissionKeys, context: context.data }, true)
  const locked = writesLocked(context.data, selection)

  const accountsQuery = useFundAccounts(branchId)
  const accounts = accountsQuery.data?.data ?? []

  const [summary, setSummary] = useState<PosFundVoucherSummary | null>(null)
  const lastRowsRef = useRef<PosFundVoucher[]>([])
  const [creatingKind, setCreatingKind] = useState<'income' | 'expense' | null>(null)
  const [selectedVoucher, setSelectedVoucher] = useState<PosFundVoucher | null>(null)
  const [notice, setNotice] = useState('')

  const patchSearch = useCallback(
    (patch: Record<string, unknown>) =>
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, ...patch, page: undefined }),
      }),
    [navigate],
  )

  const openVoucher = useCallback((id: string) => {
    const found = lastRowsRef.current.find((row) => row.id === id)
    if (found) setSelectedVoucher(found)
  }, [])
  useRowClickBridge('data-pos-voucher-id', openVoucher)

  const applyPreset = (preset: DatePreset) => {
    const today = new Date().toISOString().slice(0, 10)
    const range = datePresetRange(preset, today)
    patchSearch({ from: range.from, to: range.to })
  }

  const exportCsv = () => {
    const rows = lastRowsRef.current
    downloadCsv(
      `so-thu-chi-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        t('financeVoucherCode'),
        t('financeKind'),
        t('financeVoucherOccurredAt'),
        t('financeVoucherAmount'),
        t('financeCategory'),
        t('financeAccount'),
        t('financeVoucherCounterparty'),
        t('financeStatus'),
        t('financeVoucherReference'),
        t('financeVoucherNote'),
      ],
      rows.map((v) => [
        v.code,
        t(`financeKind_${v.kind}`),
        formatInstant(v.occurred_at, i18n.language, timeZone),
        v.kind === 'expense' ? `-${v.amount}` : v.amount,
        v.category_label || t(`financeCat_${v.category_code}`),
        v.fund_account_name,
        v.counterparty_name ?? '',
        t(`financeStatus_${v.status}`),
        v.reference ?? '',
        v.note ?? '',
      ]),
    )
  }

  const tableKey = 'pos-fund-vouchers'
  defineTable<PosFundVoucher>(tableKey, {
    searchParam: 'search',
    searchPlaceholder: t('financeSearchVouchers'),
    emptyMessage: t('financeVoucherEmpty'),
    columns: [
      {
        key: 'code',
        label: t('financeVoucherCode'),
        default: true,
        sortable: false,
        render: (voucher) => (
          <ResourceNameCell
            id={voucher.id}
            dataAttr="data-pos-voucher-id"
            name={voucher.code}
            secondary={formatInstant(voucher.occurred_at, i18n.language, timeZone)}
          />
        ),
      },
      {
        key: 'kind',
        label: t('financeKind'),
        default: true,
        sortable: false,
        render: (voucher) => (
          <Badge
            variant={
              voucher.kind === 'income'
                ? 'secondary'
                : voucher.kind === 'expense'
                  ? 'warning'
                  : 'outline'
            }
          >
            {t(`financeKind_${voucher.kind}`)}
          </Badge>
        ),
      },
      {
        key: 'amount',
        label: t('financeVoucherAmount'),
        default: true,
        sortable: false,
        className: 'text-right tabular-nums font-medium',
        render: (voucher) => {
          const prefix = voucher.kind === 'income' ? '+' : voucher.kind === 'expense' ? '-' : ''
          const color =
            voucher.status === 'voided'
              ? 'line-through text-muted-foreground'
              : voucher.kind === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : voucher.kind === 'expense'
                  ? 'text-destructive'
                  : ''
          return (
            <span className={color}>
              {prefix}
              {formatMoney(voucher.amount, voucher.currency)}
            </span>
          )
        },
      },
      {
        key: 'category',
        label: t('financeCategory'),
        default: true,
        sortable: false,
        render: (voucher) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span>{voucher.category_label || t(`financeCat_${voucher.category_code}`)}</span>
            {voucher.kind === 'expense' && !voucher.tax_deductible && (
              <Badge variant="outline">{t('financeNonDeductibleBadge')}</Badge>
            )}
          </div>
        ),
      },
      {
        key: 'account',
        label: t('financeAccount'),
        default: true,
        sortable: false,
        render: (voucher) =>
          voucher.kind === 'transfer' && voucher.target_fund_account_name
            ? `${voucher.fund_account_name} → ${voucher.target_fund_account_name}`
            : voucher.fund_account_name,
      },
      {
        key: 'counterparty',
        label: t('financeVoucherCounterparty'),
        default: true,
        sortable: false,
        render: (voucher) => voucher.counterparty_name || '—',
      },
      {
        key: 'status',
        label: t('financeStatus'),
        default: true,
        sortable: false,
        render: (voucher) => (
          <Badge variant={voucher.status === 'voided' ? 'destructive' : 'secondary'}>
            {t(`financeStatus_${voucher.status}`)}
          </Badge>
        ),
      },
      ...hiddenTimestamps<PosFundVoucher>(),
    ],
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('financeTotalIncome')}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatMoney(summary?.total_income ?? '0', currency)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('financeTotalExpense')}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-destructive">
            {formatMoney(summary?.total_expense ?? '0', currency)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('financeNetChange')}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {formatMoney(summary?.net_change ?? '0', currency)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset(preset)}
          >
            {t(`financePreset_${preset}`)}
          </Button>
        ))}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label={t('financeDateFrom')}
            value={search.from ?? ''}
            onChange={(e) => patchSearch({ from: e.target.value || undefined })}
            className="h-8 w-auto"
          />
          <span className="text-sm text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label={t('financeDateTo')}
            value={search.to ?? ''}
            onChange={(e) => patchSearch({ to: e.target.value || undefined })}
            className="h-8 w-auto"
          />
        </div>
        {(search.from ||
          search.to ||
          search.kind ||
          search.accountId ||
          search.status ||
          search.category) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              patchSearch({
                from: undefined,
                to: undefined,
                kind: undefined,
                accountId: undefined,
                status: undefined,
                category: undefined,
              })
            }
          >
            {t('financeAll')}
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <ResourceTable<PosFundVoucher>
        tableKey={tableKey}
        hideHeader
        queryKey={[
          'pos',
          'fund-vouchers',
          branchId,
          search.kind ?? 'all',
          search.accountId ?? 'all',
          search.status ?? 'all',
          search.category ?? 'all',
          search.from ?? '',
          search.to ?? '',
        ]}
        queryFn={async (params: Record<string, unknown>) => {
          const page = await fetchFundVouchers(
            branchId,
            {
              kind: search.kind && search.kind !== 'all' ? search.kind : undefined,
              fundAccountId: search.accountId,
              status: search.status && search.status !== 'all' ? search.status : undefined,
              categoryCode:
                search.category && search.category !== 'all' ? search.category : undefined,
              from: search.from,
              to: search.to,
              search: String(params.search ?? '').trim() || undefined,
            },
            params,
          )
          lastRowsRef.current = page.data
          if (page.meta.summary) setSummary(page.meta.summary)
          return page
        }}
        searchParams={search}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label={t('financeKind')}
              value={search.kind ?? 'all'}
              options={[
                { value: 'all', label: `${t('financeKind')}: ${t('financeAll')}` },
                { value: 'income', label: t('financeKind_income') },
                { value: 'expense', label: t('financeKind_expense') },
                { value: 'transfer', label: t('financeKind_transfer') },
              ]}
              onChange={(value) => patchSearch({ kind: value === 'all' ? undefined : value })}
            />
            {accounts.length > 0 && (
              <FilterSelect
                label={t('financeAccount')}
                value={search.accountId ?? 'all'}
                options={[
                  { value: 'all', label: `${t('financeAccount')}: ${t('financeAll')}` },
                  ...accounts.map((a) => ({ value: a.id, label: a.name })),
                ]}
                onChange={(value) =>
                  patchSearch({ accountId: value === 'all' ? undefined : value })
                }
              />
            )}
            <FilterSelect
              label={t('financeStatus')}
              value={search.status ?? 'all'}
              options={[
                { value: 'all', label: `${t('financeStatus')}: ${t('financeAll')}` },
                { value: 'completed', label: t('financeStatus_completed') },
                { value: 'voided', label: t('financeStatus_voided') },
              ]}
              onChange={(value) => patchSearch({ status: value === 'all' ? undefined : value })}
            />
            <FilterSelect
              label={t('financeCategory')}
              value={search.category ?? 'all'}
              options={[
                { value: 'all', label: `${t('financeCategory')}: ${t('financeAll')}` },
                ...ALL_CATS.map((code) => ({ value: code, label: t(`financeCat_${code}`) })),
              ]}
              onChange={(value) => patchSearch({ category: value === 'all' ? undefined : value })}
            />
            <Button type="button" variant="outline" onClick={exportCsv}>
              <DownloadIcon className="size-4" />
              {t('financeExportCsv')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void client.invalidateQueries({ queryKey: ['pos', storeId, 'fund-vouchers'] })
              }
            >
              <RotateCcwIcon className="size-4" />
              {t('refresh')}
            </Button>
            {canWrite && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={locked}
                  onClick={() => setCreatingKind('expense')}
                >
                  <PlusIcon className="size-4" />
                  {t('financeNewExpense')}
                </Button>
                <Button type="button" disabled={locked} onClick={() => setCreatingKind('income')}>
                  <PlusIcon className="size-4" />
                  {t('financeNewIncome')}
                </Button>
              </>
            )}
          </div>
        }
        rowActions={(voucher) => (
          <RowActions
            actions={[
              {
                key: 'view',
                label: t('financeVoucherDetail'),
                onSelect: () => setSelectedVoucher(voucher),
              },
            ]}
          />
        )}
      />

      {creatingKind && (
        <CreateVoucherDialog
          branchId={branchId}
          kind={creatingKind}
          accounts={accounts}
          currency={currency}
          onClose={() => setCreatingKind(null)}
          onCreated={(voucher, keepOpen) => {
            setNotice(t('financeVoucherCreated', { code: voucher.code }))
            void client.invalidateQueries({ queryKey: ['pos', 'fund-vouchers'] })
            if (!keepOpen) setCreatingKind(null)
          }}
        />
      )}

      {selectedVoucher && (
        <VoucherDetailSheet
          voucher={selectedVoucher}
          canWrite={canWrite && !locked}
          onClose={() => setSelectedVoucher(null)}
          onVoided={(updated) => {
            setSelectedVoucher(updated)
            setNotice(t('financeVoucherVoided'))
            void client.invalidateQueries({ queryKey: ['pos', 'fund-vouchers'] })
          }}
        />
      )}
    </div>
  )
}

function CreateVoucherDialog({
  branchId,
  kind,
  accounts,
  currency,
  onClose,
  onCreated,
}: {
  branchId: string
  kind: 'income' | 'expense'
  accounts: PosFundAccount[]
  currency: string
  onClose: () => void
  onCreated: (voucher: PosFundVoucher, keepOpen: boolean) => void
}) {
  const { t } = useTranslation()
  const ids = useId()
  const create = useCreateFundVoucher()
  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryCode, setCategoryCode] = useState<string>(categories[0])
  const [categoryLabel, setCategoryLabel] = useState('')
  const [nonDeductible, setNonDeductible] = useState(false)
  const [counterparty, setCounterparty] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [error, setError] = useState('')

  const parsedAmount = parseVndInput(amount)
  const effectiveAccountId = accountId || accounts[0]?.id || ''

  async function submit(keepOpen: boolean) {
    if (!parsedAmount || parsedAmount === '0') {
      setError(t('invalid'))
      return
    }
    setError('')
    try {
      const created = await create.mutateAsync({
        branchId,
        kind,
        fundAccountId: effectiveAccountId,
        amount: parsedAmount,
        categoryCode,
        categoryLabel: categoryLabel.trim() || undefined,
        taxDeductible: kind === 'expense' ? !nonDeductible : true,
        counterpartyName: counterparty.trim() || undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      })
      if (keepOpen) {
        setAmount('')
        setCounterparty('')
        setReference('')
        setNote('')
      }
      onCreated(created, keepOpen)
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !create.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === 'income' ? t('financeNewIncome') : t('financeNewExpense')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void submit(false)
          }}
        >
          <DialogBody className="space-y-4">
            <div className="grid gap-1">
              <Label htmlFor={`${ids}-amount`}>{t('financeVoucherAmount')}</Label>
              <Input
                id={`${ids}-amount`}
                inputMode="numeric"
                autoComplete="off"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={create.isPending}
              />
              {parsedAmount && parsedAmount !== '0' && (
                <p className="text-xs text-muted-foreground">{vndToWords(parsedAmount)}</p>
              )}
            </div>

            {accounts.length > 0 && (
              <div className="grid gap-1">
                <Label htmlFor={`${ids}-account`}>{t('financeAccount')}</Label>
                <FilterSelect
                  label={t('financeAccount')}
                  value={effectiveAccountId}
                  options={accounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} (${formatMoney(acc.current_balance, currency)})`,
                  }))}
                  onChange={setAccountId}
                />
              </div>
            )}

            <div className="grid gap-1">
              <Label htmlFor={`${ids}-cat`}>{t('financeCategory')}</Label>
              <FilterSelect
                label={t('financeCategory')}
                value={categoryCode}
                options={categories.map((code) => ({
                  value: code,
                  label: t(`financeCat_${code}`),
                }))}
                onChange={setCategoryCode}
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor={`${ids}-custom-cat`}>{t('financeCustomLabel')}</Label>
              <Input
                id={`${ids}-custom-cat`}
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
                disabled={create.isPending}
              />
            </div>

            {kind === 'expense' && (
              <div className="flex items-start gap-2 rounded-md border p-3">
                <Checkbox
                  id={`${ids}-nondeductible`}
                  checked={nonDeductible}
                  onCheckedChange={(checked) => setNonDeductible(checked === true)}
                />
                <div className="grid gap-0.5 leading-none">
                  <Label htmlFor={`${ids}-nondeductible`}>{t('financeNonDeductible')}</Label>
                  <p className="text-xs text-muted-foreground">{t('financeNonDeductibleHint')}</p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor={`${ids}-counterparty`}>{t('financeVoucherCounterparty')}</Label>
                <Input
                  id={`${ids}-counterparty`}
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  disabled={create.isPending}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${ids}-occurred`}>{t('financeVoucherOccurredAt')}</Label>
                <Input
                  id={`${ids}-occurred`}
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  disabled={create.isPending}
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor={`${ids}-ref`}>{t('financeVoucherReference')}</Label>
              <Input
                id={`${ids}-ref`}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={create.isPending}
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor={`${ids}-note`}>{t('financeVoucherNote')}</Label>
              <Input
                id={`${ids}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={create.isPending}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={onClose}>
              {t('adminCancel')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={() => void submit(true)}
            >
              {t('financeSaveAndNew')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('waiting') : t('financeSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VoucherDetailSheet({
  voucher,
  canWrite,
  onClose,
  onVoided,
}: {
  voucher: PosFundVoucher
  canWrite: boolean
  onClose: () => void
  onVoided: (updated: PosFundVoucher) => void
}) {
  const { t, i18n } = useTranslation()
  const { context } = usePosSession()
  const timeZone = branchTimeZone(context.data)
  const voidMutation = useVoidFundVoucher()
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  async function confirmVoid(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const updated = await voidMutation.mutateAsync({
        voucherId: voucher.id,
        reason: reason.trim(),
      })
      setVoiding(false)
      onVoided(updated)
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t('financeVoucherDetail')} · {voucher.code}
          </SheetTitle>
          <SheetDescription>
            {formatInstant(voucher.occurred_at, i18n.language, timeZone)}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={voucher.status === 'voided' ? 'destructive' : 'secondary'}>
                {t(`financeStatus_${voucher.status}`)}
              </Badge>
              <Badge variant="outline">{t(`financeKind_${voucher.kind}`)}</Badge>
              {voucher.kind === 'expense' && !voucher.tax_deductible && (
                <Badge variant="warning">{t('financeNonDeductibleBadge')}</Badge>
              )}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
              <PrinterIcon className="size-4" />
              {t('financeVoucherPrint')}
            </Button>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(voucher.amount, voucher.currency)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{vndToWords(voucher.amount)}</div>
          </div>

          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('financeAccount')}</dt>
            <dd className="text-right">
              {voucher.kind === 'transfer' && voucher.target_fund_account_name
                ? `${voucher.fund_account_name} → ${voucher.target_fund_account_name}`
                : voucher.fund_account_name}
            </dd>
            <dt className="text-muted-foreground">{t('financeCategory')}</dt>
            <dd className="text-right">
              {voucher.category_label || t(`financeCat_${voucher.category_code}`)}
            </dd>
            <dt className="text-muted-foreground">{t('financeVoucherCounterparty')}</dt>
            <dd className="text-right">{voucher.counterparty_name || '—'}</dd>
            <dt className="text-muted-foreground">{t('financeVoucherReference')}</dt>
            <dd className="text-right">{voucher.reference || '—'}</dd>
            <dt className="text-muted-foreground">{t('financeVoucherNote')}</dt>
            <dd className="text-right">{voucher.note || '—'}</dd>
            {voucher.void_reason && (
              <>
                <dt className="text-muted-foreground">{t('financeVoucherVoidReason')}</dt>
                <dd className="text-right text-destructive">{voucher.void_reason}</dd>
              </>
            )}
          </dl>

          {canWrite && voucher.status === 'completed' && !voiding && (
            <Button type="button" variant="destructive" onClick={() => setVoiding(true)}>
              {t('financeVoucherVoid')}
            </Button>
          )}

          {voiding && (
            <form className="space-y-3 rounded-md border p-3" onSubmit={(e) => void confirmVoid(e)}>
              <div className="grid gap-1">
                <Label htmlFor="void-reason">{t('financeVoucherVoidReason')}</Label>
                <Input
                  id="void-reason"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={voidMutation.isPending}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" disabled={voidMutation.isPending}>
                  {t('financeVoucherVoid')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setVoiding(false)}>
                  {t('adminCancel')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
