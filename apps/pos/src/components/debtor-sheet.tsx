import { debtReminderMessage } from '@shared/debt-reminder'
import { downloadCsv } from '@shared/finance'
import { formatMoney } from '@shared/money'
import { payLaterQr } from '@shared/pay-later'
import { amountSign, formatDueDate } from '@shared/receivables'
import { describeFailure } from '@shared/request-failure'
import type { PosReceivable, PosReceivableAccount } from '@shared/types/pos-context'
import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@spree/dashboard-ui'
import { DownloadIcon, PrinterIcon } from '@spree/dashboard-ui/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useCustomerReceivables,
  useReceivableLedger,
  useRemindDebt,
  useSetPromisedPayOn,
} from '../hooks/use-debts'
import { usePosSession } from '../hooks/use-pos-session'
import { branchTimeZone, formatInstant } from '../lib/format-time'
import { canSendReminders } from '../lib/pos-access'
import { copyMessage, type ShareOutcome, shareMessage } from '../lib/share-message'

// One customer who owes: contacts as the server returns them (masked for
// readers who may not see them), their open debts, and the reminder.
export function DebtorSheet({
  branchId,
  account,
  loading,
  onClose,
}: {
  branchId: string
  account: PosReceivableAccount | null
  loading: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const { context } = usePosSession()
  const timeZone = branchTimeZone(context.data)
  const phone = account?.customer.phone ?? null
  // Only an unmasked phone is dialable.
  const dialable = phone && /^[+\d\s.-]+$/.test(phone) ? phone.replace(/[\s.-]/g, '') : null
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{account?.customer.name ?? t('receivablesCustomers')}</SheetTitle>
          {account && (
            <SheetDescription>
              {t('receivablesOrderCount', { count: account.orders })} ·{' '}
              {formatMoney(account.balance, account.currency)}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          {!account ? (
            <p role={loading ? 'status' : 'alert'}>{t(loading ? 'waiting' : 'missing')}</p>
          ) : (
            <>
              <dl className="grid gap-2 text-sm">
                {phone && (
                  <div>
                    <dt className="text-muted-foreground">{t('customerPhone')}</dt>
                    <dd>{dialable ? <a href={`tel:${dialable}`}>{phone}</a> : phone}</dd>
                  </div>
                )}
                {account.customer.address && (
                  <div>
                    <dt className="text-muted-foreground">{t('customerAddress')}</dt>
                    <dd>{account.customer.address}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">{t('receivablesOverdue')}</dt>
                  <dd>
                    <OverdueBadge account={account} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('debtorsLastRemindedLabel')}</dt>
                  <dd>
                    {account.last_reminded_at
                      ? formatInstant(account.last_reminded_at, i18n.language, timeZone)
                      : t('debtorsNeverReminded')}
                  </dd>
                </div>
              </dl>
              {canSendReminders({ permissionKeys: [], context: context.data }) && (
                <>
                  {!account.settled && <PromisedDateEditor account={account} branchId={branchId} />}
                  {!account.settled && <ReminderActions account={account} branchId={branchId} />}
                </>
              )}
              <DebtorTabs branchId={branchId} account={account} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PromisedDateEditor({
  account,
  branchId,
}: {
  account: PosReceivableAccount
  branchId: string
}) {
  const { t } = useTranslation()
  const setPromised = useSetPromisedPayOn()
  const [date, setDate] = useState(account.promised_pay_on ?? '')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')

  async function save(next: string | null) {
    setError('')
    setStatusMsg('')
    try {
      await setPromised.mutateAsync({
        branchId,
        creditAccountId: account.credit_account_id,
        promisedPayOn: next,
      })
      setDate(next ?? '')
      setStatusMsg(t('receivablesPromisedSaved'))
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }

  return (
    <section className="space-y-2 rounded-md border p-3" aria-label={t('receivablesPromisedPayOn')}>
      <Label htmlFor={`promised-${account.credit_account_id}`}>
        {t('receivablesPromisedPayOn')}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`promised-${account.credit_account_id}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={setPromised.isPending}
          className="h-9 w-auto"
        />
        <Button
          type="button"
          size="sm"
          disabled={setPromised.isPending || !date}
          onClick={() => void save(date)}
        >
          {t('financeSave')}
        </Button>
        {(date || account.promised_pay_on) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={setPromised.isPending}
            onClick={() => void save(null)}
          >
            {t('receivablesPromisedClear')}
          </Button>
        )}
      </div>
      {statusMsg && (
        <p role="status" className="text-xs text-muted-foreground">
          {statusMsg}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

function DebtorTabs({ branchId, account }: { branchId: string; account: PosReceivableAccount }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'orders' | 'ledger'>(account.settled ? 'ledger' : 'orders')
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2" role="tablist">
        <Button
          type="button"
          size="sm"
          role="tab"
          aria-selected={tab === 'orders'}
          variant={tab === 'orders' ? 'default' : 'ghost'}
          onClick={() => setTab('orders')}
        >
          {t('receivablesOpenOrdersTab')}
        </Button>
        <Button
          type="button"
          size="sm"
          role="tab"
          aria-selected={tab === 'ledger'}
          variant={tab === 'ledger' ? 'default' : 'ghost'}
          onClick={() => setTab('ledger')}
        >
          {t('receivablesLedgerTab')}
        </Button>
      </div>
      {tab === 'orders' ? (
        <CustomerDebts branchId={branchId} customerId={account.customer.id} />
      ) : (
        <CustomerLedger branchId={branchId} account={account} />
      )}
    </div>
  )
}

function CustomerLedger({
  branchId,
  account,
}: {
  branchId: string
  account: PosReceivableAccount
}) {
  const { t, i18n } = useTranslation()
  const { context } = usePosSession()
  const timeZone = branchTimeZone(context.data)
  const ledger = useReceivableLedger(branchId, account.credit_account_id)
  const summary = ledger.data?.meta
  const entries = ledger.data?.data ?? []

  const exportStatement = () => {
    downloadCsv(
      `doi-chieu-cong-no-${account.customer.name.replace(/\s+/g, '-')}.csv`,
      [
        t('financeVoucherOccurredAt'),
        t('financeKind'),
        t('receivablesOrders'),
        t('financeVoucherAmount'),
        t('receivablesBalanceAfter'),
      ],
      entries.map((entry) => [
        formatInstant(entry.created_at, i18n.language, timeZone),
        t(`receivablesEntry_${entry.kind}`),
        entry.order_number ?? '',
        entry.signed_amount,
        entry.balance_after,
      ]),
    )
  }

  return (
    <section className="space-y-3" aria-label={t('receivablesLedgerTab')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t('receivablesLedgerTab')}</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={exportStatement}>
            <DownloadIcon className="size-4" />
            {t('receivablesLedgerExport')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            <PrinterIcon className="size-4" />
            {t('receivablesLedgerPrint')}
          </Button>
        </div>
      </div>

      {summary && (
        <dl className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t('receivablesLedgerDebited')}</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(summary.total_debited, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('receivablesLedgerCollected')}</dt>
            <dd className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(summary.total_collected, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('receivablesLedgerCreditNotes')}</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(summary.total_credit_notes, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('receivablesLedgerBalance')}</dt>
            <dd className="font-semibold tabular-nums">
              {formatMoney(summary.current_balance, summary.currency)}
            </dd>
          </div>
        </dl>
      )}

      {ledger.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {describeFailure(ledger.error, t)}
        </p>
      ) : ledger.isPending ? (
        <p role="status">{t('waiting')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('receivablesLedgerEmpty')}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {entries.map((entry) => {
            const positive = Number(entry.signed_amount) >= 0
            return (
              <li key={entry.id} className="flex items-start justify-between gap-3 p-3">
                <div className="space-y-0.5">
                  <div className="font-medium">
                    {t(`receivablesEntry_${entry.kind}`)}
                    {entry.order_number ? ` · ${entry.order_number}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatInstant(entry.created_at, i18n.language, timeZone)}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div
                    className={
                      positive
                        ? 'font-medium text-destructive'
                        : 'font-medium text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {positive ? '+' : ''}
                    {formatMoney(entry.signed_amount, entry.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('receivablesBalanceAfter')}:{' '}
                    {formatMoney(entry.balance_after, entry.currency)}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// "Nhắc nợ": a polite reminder with the open orders and one QR for the total,
// through the share sheet (Zalo) or the clipboard. A shared or copied
// reminder is recorded as "Nhắc lần cuối".
function ReminderActions({
  account,
  branchId,
}: {
  account: PosReceivableAccount
  branchId: string
}) {
  const { t } = useTranslation()
  const { context } = usePosSession()
  const remind = useRemindDebt()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const [recordFailed, setRecordFailed] = useState(false)
  const qr = payLaterQr(account.pay_later)

  async function send(via: 'share' | 'copy') {
    setBusy(true)
    setOutcome(null)
    setRecordFailed(false)
    try {
      const message = debtReminderMessage(account, qr, t, context.data?.store.name)
      const result =
        via === 'share'
          ? await shareMessage(message, qr, t('debtReminderTitle'))
          : await copyMessage(message)
      setOutcome(result)
      if (result === 'shared' || result === 'copied') {
        // The message is already out; failing to note it only loses the timestamp.
        await remind
          .mutateAsync({ branchId, creditAccountId: account.credit_account_id, via })
          .catch(() => setRecordFailed(true))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2" aria-label={t('debtReminderTitle')}>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void send('share')}>
          {t('debtReminderShare')}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void send('copy')}>
          {t('debtReminderCopy')}
        </Button>
      </div>
      {outcome === 'copied' && (
        <p role="status" className="text-sm">
          {t('payLaterCopied')}
        </p>
      )}
      {outcome === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {t('payLaterShareFailed')}
        </p>
      )}
      {recordFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t('debtReminderRecordFailed')}
        </p>
      )}
      {!qr && <p className="text-sm text-muted-foreground">{t('debtReminderNoQr')}</p>}
    </section>
  )
}

function CustomerDebts({ branchId, customerId }: { branchId: string; customerId: string }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const debts = useCustomerReceivables(branchId, customerId, 'open', page)
  const pages = debts.data?.meta.pages ?? 1
  return (
    <section className="space-y-3" aria-label={t('receivablesOrders')}>
      <h3 className="font-medium">{t('receivablesOrders')}</h3>
      {debts.isError ? (
        <div role="alert" className="space-y-2">
          <p>{describeFailure(debts.error, t)}</p>
          <Button variant="outline" onClick={() => void debts.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : !debts.data ? (
        <p role="status">{t('waiting')}</p>
      ) : debts.data.data.length === 0 ? (
        <p className="text-muted-foreground">{t('receivablesEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {debts.data.data.map((debt) => (
            <DebtCard key={debt.order_id} debt={debt} />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || debts.isFetching}
            onClick={() => setPage((value) => value - 1)}
          >
            {t('previousPage')}
          </Button>
          <span className="text-sm tabular-nums">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || debts.isFetching}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('nextPage')}
          </Button>
        </div>
      )}
    </section>
  )
}

function DebtCard({ debt }: { debt: PosReceivable }) {
  const { t } = useTranslation()
  const rows: [string, string, boolean][] = [
    ['receivablesOriginal', debt.original_total, true],
    ['receivablesPaidAtSale', debt.paid_at_sale, true],
    ['receivablesDebt', debt.debt, true],
    ['receivablesCreditNotes', debt.credit_notes, amountSign(debt.credit_notes) !== 0],
    ['receivablesCollected', debt.collected, true],
    ['receivablesRefunds', debt.refunds, amountSign(debt.refunds) !== 0],
  ]
  return (
    <li className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <strong>{debt.order_number}</strong>
        <DueBadge debt={debt} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows
          .filter(([, , shown]) => shown)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{t(label)}</dt>
              <dd className="text-right tabular-nums">{formatMoney(value, debt.currency)}</dd>
            </div>
          ))}
        <dt className="font-medium">{t('receivablesBalance')}</dt>
        <dd className="text-right font-medium tabular-nums">
          {formatMoney(debt.balance, debt.currency)}
        </dd>
      </dl>
    </li>
  )
}

export function OverdueBadge({ account }: { account: PosReceivableAccount }) {
  const { t } = useTranslation()
  if (amountSign(account.overdue) <= 0) return <span className="text-muted-foreground">—</span>
  return (
    <Badge variant="warning">
      {(account.days_overdue ?? 0) > 0
        ? t('receivablesDaysOverdue', { count: account.days_overdue })
        : t('receivablesOverdue')}
      : {formatMoney(account.overdue, account.currency)}
    </Badge>
  )
}

export function DueBadge({ debt }: { debt: PosReceivable }) {
  const { t } = useTranslation()
  return debt.overdue ? (
    <Badge variant="warning">{t('receivablesDaysOverdue', { count: debt.days_overdue })}</Badge>
  ) : (
    <span className="whitespace-nowrap">{formatDueDate(debt.due_on)}</span>
  )
}
