import { formatMoney, parseVndInput } from '@shared/money'
import { writesLocked } from '@shared/pos-context'
import { describeFailure } from '@shared/request-failure'
import type { PosFundAccount } from '@shared/types/pos-context'
import { usePermissions } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@spree/dashboard-ui'
import { ArrowLeftRightIcon, BanknoteIcon, PlusIcon } from '@spree/dashboard-ui/icons'
import { type FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useCreateFundAccount,
  useFundAccounts,
  useTransferFunds,
  useUpdateFundAccount,
} from '../../hooks/use-finance'
import { usePosSession } from '../../hooks/use-pos-session'
import { canAdminister, hasCapability } from '../../lib/pos-access'
import { FilterSelect } from '../filter-select'

export function FundAccountsView({ branchId }: { branchId: string }) {
  const { t } = useTranslation()
  const { permissionKeys } = usePermissions()
  const { context, selection } = usePosSession()
  const query = useFundAccounts(branchId)
  const currency = query.data?.meta.currency ?? context.data?.store.currency ?? 'VND'
  const accounts = query.data?.data ?? []
  const cashAccounts = accounts.filter((a) => a.kind === 'cash')
  const bankAccounts = accounts.filter((a) => a.kind !== 'cash')
  const canWrite =
    hasCapability({ permissionKeys, context: context.data }, 'pos.payment.resolve') ||
    canAdminister({ permissionKeys, context: context.data }, true)
  const locked = writesLocked(context.data, selection)

  const [editing, setEditing] = useState<'create' | PosFundAccount | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [notice, setNotice] = useState('')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5">
        <div>
          <div className="text-sm text-muted-foreground">{t('fundTotalBalance')}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(query.data?.meta.total_balance ?? '0', currency)}
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={locked || accounts.length < 2}
              onClick={() => setTransferring(true)}
            >
              <ArrowLeftRightIcon className="size-4" />
              {t('fundTransfer')}
            </Button>
            <Button type="button" disabled={locked} onClick={() => setEditing('create')}>
              <PlusIcon className="size-4" />
              {t('fundAddAccount')}
            </Button>
          </div>
        )}
      </div>

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {describeFailure(query.error, t)}
        </p>
      )}

      <AccountGroup
        title={`${t('fundCashGroup')} (${cashAccounts.length})`}
        accounts={cashAccounts}
        currency={currency}
        canWrite={canWrite && !locked}
        onEdit={(acc) => setEditing(acc)}
      />

      <AccountGroup
        title={`${t('fundBankGroup')} (${bankAccounts.length})`}
        accounts={bankAccounts}
        currency={currency}
        canWrite={canWrite && !locked}
        onEdit={(acc) => setEditing(acc)}
      />

      {editing && (
        <FundAccountDialog
          branchId={branchId}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(acc) => {
            setNotice(t('fundAccountSaved', { name: acc.name }))
            setEditing(null)
          }}
        />
      )}

      {transferring && (
        <FundTransferDialog
          branchId={branchId}
          accounts={accounts}
          currency={currency}
          onClose={() => setTransferring(false)}
          onDone={(msg) => {
            setNotice(msg)
            setTransferring(false)
          }}
        />
      )}
    </div>
  )
}

function AccountGroup({
  title,
  accounts,
  currency,
  canWrite,
  onEdit,
}: {
  title: string
  accounts: PosFundAccount[]
  currency: string
  canWrite: boolean
  onEdit: (account: PosFundAccount) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">—</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex flex-col justify-between gap-3 rounded-lg border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-medium">
                    <BanknoteIcon className="size-4 text-muted-foreground" />
                    <span>{acc.name}</span>
                  </div>
                  {(acc.bank_name || acc.account_number) && (
                    <div className="text-xs text-muted-foreground">
                      {[acc.bank_name, acc.account_number].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <Badge variant="outline">{t(`fundAccountKind_${acc.kind}`)}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('fundCurrentBalance')}</div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatMoney(acc.current_balance, currency)}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-xs text-muted-foreground">
                  <div>
                    <div>{t('fundOpeningBalance')}</div>
                    <div className="tabular-nums text-foreground">
                      {formatMoney(acc.opening_balance, currency)}
                    </div>
                  </div>
                  <div>
                    <div>{t('fundInflow')}</div>
                    <div className="tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(acc.inflow, currency)}
                    </div>
                  </div>
                  <div>
                    <div>{t('fundOutflow')}</div>
                    <div className="tabular-nums text-destructive">
                      -{formatMoney(acc.outflow, currency)}
                    </div>
                  </div>
                </div>
              </div>
              {canWrite && (
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => onEdit(acc)}>
                    {t('fundEditAccount')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function FundAccountDialog({
  branchId,
  editing,
  onClose,
  onSaved,
}: {
  branchId: string
  editing: 'create' | PosFundAccount
  onClose: () => void
  onSaved: (acc: PosFundAccount) => void
}) {
  const { t } = useTranslation()
  const ids = useId()
  const existing = editing === 'create' ? null : editing
  const create = useCreateFundAccount()
  const update = useUpdateFundAccount()
  const busy = create.isPending || update.isPending

  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<'cash' | 'bank' | 'ewallet'>(existing?.kind ?? 'bank')
  const [bankName, setBankName] = useState(existing?.bank_name ?? '')
  const [accountNumber, setAccountNumber] = useState(existing?.account_number ?? '')
  const [openingBalance, setOpeningBalance] = useState(
    existing ? String(Math.round(Number(existing.opening_balance))) : '0',
  )
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    try {
      const saved = existing
        ? await update.mutateAsync({
            accountId: existing.id,
            name: name.trim(),
            bankName: bankName.trim(),
            accountNumber: accountNumber.trim(),
            openingBalance: openingBalance.trim() || '0',
          })
        : await create.mutateAsync({
            branchId,
            name: name.trim(),
            kind,
            bankName: bankName.trim() || undefined,
            accountNumber: accountNumber.trim() || undefined,
            openingBalance: openingBalance.trim() || '0',
          })
      onSaved(saved)
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? t('fundEditAccount') : t('fundAddAccount')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)}>
          <DialogBody className="space-y-4">
            {!existing && (
              <div className="grid gap-1">
                <Label>{t('fundAccountKind')}</Label>
                <FilterSelect
                  label={t('fundAccountKind')}
                  value={kind}
                  options={[
                    { value: 'cash', label: t('fundAccountKind_cash') },
                    { value: 'bank', label: t('fundAccountKind_bank') },
                    { value: 'ewallet', label: t('fundAccountKind_ewallet') },
                  ]}
                  onChange={(val) => setKind(val as 'cash' | 'bank' | 'ewallet')}
                />
              </div>
            )}
            <div className="grid gap-1">
              <Label htmlFor={`${ids}-name`}>{t('fundAccountName')}</Label>
              <Input
                id={`${ids}-name`}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </div>
            {(existing ? existing.kind !== 'cash' : kind !== 'cash') && (
              <>
                <div className="grid gap-1">
                  <Label htmlFor={`${ids}-bank`}>{t('fundBankName')}</Label>
                  <Input
                    id={`${ids}-bank`}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${ids}-accnum`}>{t('fundAccountNumber')}</Label>
                  <Input
                    id={`${ids}-accnum`}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </>
            )}
            <div className="grid gap-1">
              <Label htmlFor={`${ids}-opening`}>{t('fundOpeningBalance')}</Label>
              <Input
                id={`${ids}-opening`}
                inputMode="numeric"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                disabled={busy}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('waiting') : t('financeSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FundTransferDialog({
  branchId,
  accounts,
  currency,
  onClose,
  onDone,
}: {
  branchId: string
  accounts: PosFundAccount[]
  currency: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { t } = useTranslation()
  const ids = useId()
  const transfer = useTransferFunds()
  const [fromId, setFromId] = useState(accounts[0]?.id ?? '')
  const [toId, setToId] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const fromAcc = accounts.find((a) => a.id === fromId)
  const toAcc = accounts.find((a) => a.id === toId)
  const fromBalance = Math.max(0, Math.floor(Number(fromAcc?.current_balance ?? 0)))

  const applyFraction = (ratio: number) => {
    if (fromBalance <= 0) return
    setAmount(String(Math.floor(fromBalance * ratio)))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseVndInput(amount)
    if (!parsed || parsed === '0' || !fromId || !toId || fromId === toId) {
      setError(t('invalid'))
      return
    }
    setError('')
    try {
      await transfer.mutateAsync({
        branchId,
        fromAccountId: fromId,
        toAccountId: toId,
        amount: parsed,
        note: note.trim() || undefined,
      })
      onDone(
        t('fundTransferDone', {
          amount: formatMoney(parsed, currency),
          from: fromAcc?.name ?? '',
          to: toAcc?.name ?? '',
        }),
      )
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !transfer.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('fundTransfer')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)}>
          <DialogBody className="space-y-4">
            <div className="grid gap-1">
              <Label>{t('fundFromAccount')}</Label>
              <FilterSelect
                label={t('fundFromAccount')}
                value={fromId}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${formatMoney(a.current_balance, currency)})`,
                }))}
                onChange={setFromId}
              />
            </div>
            <div className="grid gap-1">
              <Label>{t('fundToAccount')}</Label>
              <FilterSelect
                label={t('fundToAccount')}
                value={toId}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${formatMoney(a.current_balance, currency)})`,
                }))}
                onChange={setToId}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${ids}-amt`}>{t('financeVoucherAmount')}</Label>
              <Input
                id={`${ids}-amt`}
                inputMode="numeric"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={transfer.isPending}
              />
              {fromBalance > 0 && (
                <div className="flex gap-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyFraction(0.25)}
                  >
                    25%
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyFraction(0.5)}
                  >
                    50%
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyFraction(1)}
                  >
                    {t('fundTransferAll')}
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${ids}-note`}>{t('financeVoucherNote')}</Label>
              <Input
                id={`${ids}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={transfer.isPending}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={transfer.isPending} onClick={onClose}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={transfer.isPending}>
              {transfer.isPending ? t('waiting') : t('fundTransfer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
