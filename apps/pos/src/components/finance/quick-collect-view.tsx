import { INCOME_CATEGORIES, vndToWords } from '@shared/finance'
import { formatMoney, parseVndInput } from '@shared/money'
import { writesLocked } from '@shared/pos-context'
import { describeFailure } from '@shared/request-failure'
import type { PosQuickQrResult } from '@shared/types/pos-context'
import { usePermissions } from '@spree/dashboard-core'
import { Button, Input, Label } from '@spree/dashboard-ui'
import { BanknoteIcon, CopyIcon, DownloadIcon } from '@spree/dashboard-ui/icons'
import { type FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateFundVoucher, useFundAccounts, useQuickQr } from '../../hooks/use-finance'
import { usePosSession } from '../../hooks/use-pos-session'
import { canAdminister, hasCapability } from '../../lib/pos-access'
import { FilterSelect } from '../filter-select'

export function QuickCollectView({ branchId }: { branchId: string }) {
  const { t } = useTranslation()
  const ids = useId()
  const { permissionKeys } = usePermissions()
  const { context, selection } = usePosSession()
  const currency = context.data?.store.currency ?? 'VND'
  const canWrite =
    hasCapability({ permissionKeys, context: context.data }, 'pos.payment.resolve') ||
    canAdminister({ permissionKeys, context: context.data }, true)
  const locked = writesLocked(context.data, selection)

  const quickQr = useQuickQr()
  const accountsQuery = useFundAccounts(branchId)
  const createVoucher = useCreateFundVoucher()
  const accounts = accountsQuery.data?.data ?? []

  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [categoryCode, setCategoryCode] = useState<string>('sales_other')
  const [note, setNote] = useState('')
  const [accountId, setAccountId] = useState('')
  const [qr, setQr] = useState<PosQuickQrResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const parsedAmount = parseVndInput(amount)
  const bankDefault = accounts.find((a) => a.kind !== 'cash')?.id ?? accounts[0]?.id ?? ''
  const selectedAccountId = accountId || bankDefault

  async function generate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setCopied(false)
    try {
      const result = await quickQr.mutateAsync({
        branchId,
        amount: parsedAmount && parsedAmount !== '0' ? parsedAmount : undefined,
        reference: reference.trim() || undefined,
      })
      setQr(result)
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }

  async function copyContent() {
    if (!qr?.transfer_content) return
    await navigator.clipboard.writeText(qr.transfer_content)
    setCopied(true)
  }

  async function recordVoucher() {
    if (!parsedAmount || parsedAmount === '0') {
      setError(t('invalid'))
      return
    }
    setError('')
    setNotice('')
    try {
      const created = await createVoucher.mutateAsync({
        branchId,
        kind: 'income',
        fundAccountId: selectedAccountId,
        amount: parsedAmount,
        categoryCode,
        counterpartyName: counterparty.trim() || undefined,
        reference: qr?.transfer_content || reference.trim() || undefined,
        note: note.trim() || undefined,
      })
      setNotice(t('financeVoucherCreated', { code: created.code }))
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <form className="space-y-4" onSubmit={(e) => void generate(e)}>
          <div className="grid gap-1">
            <Label htmlFor={`${ids}-amount`}>{t('quickQrAmount')}</Label>
            <Input
              id={`${ids}-amount`}
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={quickQr.isPending}
            />
            {parsedAmount && parsedAmount !== '0' && (
              <p className="text-xs text-muted-foreground">{vndToWords(parsedAmount)}</p>
            )}
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${ids}-ref`}>{t('quickQrReference')}</Label>
            <Input
              id={`${ids}-ref`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={quickQr.isPending}
            />
          </div>
          <Button type="submit" disabled={quickQr.isPending}>
            <BanknoteIcon className="size-4" />
            {quickQr.isPending ? t('waiting') : t('quickQrGenerate')}
          </Button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {qr && !qr.available && (
          <p
            role="status"
            className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          >
            {t('quickQrUnavailable')}
          </p>
        )}

        {qr?.available && (
          <div className="space-y-3 rounded-lg border p-4 text-center">
            {qr.image_url && (
              <img
                src={qr.image_url}
                alt="VietQR"
                className="mx-auto max-h-64 rounded-md border bg-white p-2"
              />
            )}
            <div className="space-y-1 text-sm">
              <div className="font-medium">
                {qr.bank_name} · {qr.account_number}
              </div>
              <div className="text-muted-foreground">{qr.account_name}</div>
              {qr.amount && Number(qr.amount) > 0 && (
                <div className="text-lg font-semibold tabular-nums">
                  {formatMoney(qr.amount, currency)}
                </div>
              )}
              <div className="rounded bg-muted px-2 py-1 font-mono text-xs">
                {qr.transfer_content}
              </div>
              <p className="text-xs text-muted-foreground">{t('quickQrHint')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyContent()}>
                <CopyIcon className="size-4" />
                {t('quickQrCopyContent')}
              </Button>
              {qr.image_url && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={qr.image_url} download={`vietqr-${qr.transfer_content}.png`}>
                    <DownloadIcon className="size-4" />
                    {t('quickQrDownload')}
                  </a>
                </Button>
              )}
            </div>
            {copied && (
              <p role="status" className="text-xs text-muted-foreground">
                {t('quickQrCopied')}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="font-medium">{t('financeVoucherDetail')}</h2>
        {accounts.length > 0 && (
          <div className="grid gap-1">
            <Label>{t('financeAccount')}</Label>
            <FilterSelect
              label={t('financeAccount')}
              value={selectedAccountId}
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.name} (${formatMoney(a.current_balance, currency)})`,
              }))}
              onChange={setAccountId}
            />
          </div>
        )}
        <div className="grid gap-1">
          <Label>{t('financeCategory')}</Label>
          <FilterSelect
            label={t('financeCategory')}
            value={categoryCode}
            options={INCOME_CATEGORIES.map((code) => ({
              value: code,
              label: t(`financeCat_${code}`),
            }))}
            onChange={setCategoryCode}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${ids}-cp`}>{t('financeVoucherCounterparty')}</Label>
          <Input
            id={`${ids}-cp`}
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${ids}-note`}>{t('financeVoucherNote')}</Label>
          <Input id={`${ids}-note`} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {canWrite && (
          <Button
            type="button"
            disabled={locked || createVoucher.isPending || !parsedAmount || parsedAmount === '0'}
            onClick={() => void recordVoucher()}
          >
            {createVoucher.isPending ? t('waiting') : t('quickQrRecordVoucher')}
          </Button>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </section>
    </div>
  )
}
