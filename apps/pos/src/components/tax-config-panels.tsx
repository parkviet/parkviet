import { formatMoney } from '@shared/money'
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@spree/dashboard-ui'
import { Link } from '@tanstack/react-router'
import { FileCheck2, Link2, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TaxReadiness } from '../hooks/use-tax-profile'
import type { TaxPreview, TaxPreviewLine, TaxRegime, TaxRevenueYear } from '../hooks/use-tax-regime'
import { formatInstant } from '../lib/format-time'
import { formatDay, thresholdFill } from '../schemas/tax-regime'
import { ModelCard } from './setup/model-ui'

const linkClass = 'font-medium text-primary underline-offset-4 hover:underline'

function Row({
  label,
  value,
  strong,
  testId,
}: {
  label: string
  value: string
  strong?: boolean
  testId?: string
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}

// The year's revenue against the threshold, for the direct method.
export function RevenueYearBar({ year }: { year: TaxRevenueYear }) {
  const { t } = useTranslation()
  const percent = Math.round(thresholdFill(year.ratio) * 100)
  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="tax-revenue-year">
      <p className="text-sm font-medium">
        {t('taxConfig.revenueYear', {
          revenue: formatMoney(year.revenue),
          threshold: formatMoney(year.threshold),
        })}
      </p>
      <div
        role="progressbar"
        aria-label={t('taxConfig.revenueYearBar')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full ${year.tax_due ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm" data-testid="tax-revenue-status">
        {year.tax_due
          ? t('taxConfig.crossed', { date: formatDay(year.crossed_on) })
          : t('taxConfig.notDue')}
      </p>
      {year.warning === 'near_80' || year.warning === 'near_95' ? (
        <p className="text-sm text-muted-foreground">
          {t('taxConfig.nearThreshold', { percent: year.warning === 'near_95' ? 95 : 80 })}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {t('taxConfig.estimatedTax', { amount: formatMoney(year.payable_amount) })}
      </p>
      {year.tax_due && year.einvoice_deadline ? (
        <p className="text-sm text-muted-foreground">
          {t('taxConfig.einvoiceDeadline', { date: formatDay(year.einvoice_deadline) })}
        </p>
      ) : null}
    </div>
  )
}

const lineName = (line: TaxPreviewLine, t: (key: string) => string) =>
  line.kind === 'item' ? t('taxConfig.sampleItem') : t('taxConfig.sampleShipping')

// The sample order under the unsaved draft, as the server computes it.
export function TaxPreviewCard({
  preview,
  failed,
  loading,
}: {
  preview: TaxPreview | undefined
  failed: boolean
  loading: boolean
}) {
  const { t } = useTranslation()
  const direct = preview?.enabled === true && preview.method === 'direct'
  const printed = preview?.lines.filter((line) => line.printed && line.vat_amount !== null) ?? []
  return (
    <ModelCard
      title={t('taxConfig.preview')}
      id="tax-config-preview"
      icon={<ReceiptText />}
      testId="tax-preview"
    >
      <p className="text-sm text-muted-foreground">{t('taxConfig.previewHint')}</p>
      {failed ? (
        <p role="status" className="text-sm text-destructive">
          {t('taxConfig.previewError')}
        </p>
      ) : null}
      {preview ? (
        <div aria-busy={loading} className="space-y-4">
          <dl className="space-y-1 text-sm">
            {preview.lines.map((line) => (
              <Row
                key={line.kind}
                label={lineName(line, t)}
                value={formatMoney(line.amount)}
                testId={`tax-preview-${line.kind}`}
              />
            ))}
            {printed.map((line) => (
              <Row
                key={`vat-${line.kind}`}
                label={`${line.label} (${lineName(line, t)})`}
                value={formatMoney(line.vat_amount)}
                testId={`tax-preview-vat-${line.kind}`}
              />
            ))}
            <Row
              strong
              label={t('taxConfig.customerPays')}
              value={formatMoney(preview.customer_total)}
              testId="tax-preview-customer-total"
            />
          </dl>
          {!preview.enabled ? (
            <p className="text-sm text-muted-foreground">{t('taxConfig.previewNoTax')}</p>
          ) : null}
          {direct ? (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">
                {t('taxConfig.owedIfOver', {
                  threshold: formatMoney(preview.revenue_year.threshold),
                })}
              </p>
              <dl className="space-y-1 text-sm">
                {preview.lines.map((line) => (
                  <div key={line.kind} className="space-y-1">
                    <Row
                      label={`${t('taxConfig.vat')} · ${lineName(line, t)}`}
                      value={formatMoney(line.vat_amount ?? '0')}
                      testId={`tax-preview-owed-vat-${line.kind}`}
                    />
                    <Row
                      label={`${t('taxConfig.pit')} · ${lineName(line, t)}`}
                      value={formatMoney(line.pit_amount ?? '0')}
                      testId={`tax-preview-owed-pit-${line.kind}`}
                    />
                  </div>
                ))}
                <Row
                  strong
                  label={t('taxConfig.vatTotal')}
                  value={formatMoney(preview.vat_total)}
                  testId="tax-preview-owed-vat-total"
                />
                <Row
                  strong
                  label={t('taxConfig.pitTotal')}
                  value={formatMoney(preview.pit_total)}
                  testId="tax-preview-owed-pit-total"
                />
              </dl>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('taxConfig.previewLoading')}</p>
      )}
    </ModelCard>
  )
}

type Usage = { key: string; path: string | null; ready: boolean }
// Where a store's tax configuration reaches; the pages that do not read it yet
// say so.
const USAGES: Usage[] = [
  { key: 'menu', path: '/menu', ready: true },
  { key: 'serviceFee', path: null, ready: false },
  { key: 'einvoice', path: '/settings/einvoice', ready: true },
  { key: 'receipt', path: '/settings/receipt-templates', ready: true },
  { key: 'reports', path: null, ready: false },
]

export function TaxUsageCard({ storeId }: { storeId: string | null }) {
  const { t } = useTranslation()
  return (
    <ModelCard title={t('taxConfig.usage')} id="tax-config-usage" icon={<Link2 />}>
      <ul className="space-y-2 text-sm">
        {USAGES.map((usage) => (
          <li key={usage.key} className="flex items-center justify-between gap-3">
            {usage.path && storeId ? (
              <Link to={`/${storeId}${usage.path}` as string} className={linkClass}>
                {t(`taxConfig.usage_${usage.key}`)}
              </Link>
            ) : (
              <span>{t(`taxConfig.usage_${usage.key}`)}</span>
            )}
            {usage.ready ? null : <Badge variant="outline">{t('taxConfig.comingSoon')}</Badge>}
          </li>
        ))}
      </ul>
    </ModelCard>
  )
}

export function TaxReadinessCard({
  readiness,
  storeId,
}: {
  readiness: TaxReadiness
  storeId: string | null
}) {
  const { t } = useTranslation()
  const missing = readiness.missing.map((field) => t(`taxInfo.required_${field}`))
  return (
    <ModelCard title={t('taxConfig.readiness')} id="tax-config-readiness" icon={<FileCheck2 />}>
      <p className="text-sm" data-testid="tax-config-missing">
        {missing.length > 0
          ? t('taxConfig.missing', { list: missing.join(', ') })
          : t('taxConfig.complete')}
      </p>
      {storeId ? (
        <Link to={`/${storeId}/settings/tax-info` as string} className={linkClass}>
          {t('taxConfig.openTaxInfo')}
        </Link>
      ) : null}
    </ModelCard>
  )
}

// The regime in force and the changes that led to it.
export function TaxRegimeFooter({
  regime,
  history,
  locale,
  timeZone,
}: {
  regime: TaxRegime | null
  history: TaxRegime[]
  locale: string
  timeZone: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!regime) return <p className="text-sm text-muted-foreground">{t('taxConfig.neverSaved')}</p>
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span data-testid="tax-applied-since">
        {t('taxConfig.appliedSince', { date: formatInstant(regime.created_at, locale, timeZone) })}
      </span>
      <Button type="button" variant="link" onClick={() => setOpen(true)}>
        {t('taxConfig.history')}
      </Button>
      {open ? (
        <Dialog open onOpenChange={(next) => !next && setOpen(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('taxConfig.history')}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <ol className="space-y-3 text-sm">
                {history.map((row) => (
                  <li key={row.id} className="space-y-0.5">
                    <p className="font-medium">
                      {formatInstant(row.created_at, locale, timeZone)}
                      {row.changed_by_name ? ` · ${row.changed_by_name}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      {row.enabled
                        ? t('taxConfig.historyRow', {
                            method: t(`taxConfig.method_${row.method}`),
                            group: t(`taxConfig.groupName_${row.revenue_group}`),
                          })
                        : t('taxConfig.historyOff')}
                    </p>
                  </li>
                ))}
              </ol>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('taxConfig.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
