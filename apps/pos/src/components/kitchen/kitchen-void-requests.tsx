import { describeFailure } from '@shared/request-failure'
import { Badge, Button, Tabs, TabsList, TabsTrigger, useConfirm } from '@spree/dashboard-ui'
import { CheckIcon, XIcon } from '@spree/dashboard-ui/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type KitchenVoidRequest,
  useDecideVoidRequest,
  useKitchenVoidRequests,
  type VoidRequestGroup,
} from '../../hooks/use-kitchen-void-requests'
import { usePosSession } from '../../hooks/use-pos-session'
import { branchTimeZone, formatInstant } from '../../lib/format-time'

// Requests to take back a dish already sent to the kitchen: pending ones wait
// for a decision here, decided ones stay listed for review.
export function KitchenVoidRequests({
  branchId,
  group,
  onGroup,
}: {
  branchId: string
  group: VoidRequestGroup
  onGroup: (group: VoidRequestGroup) => void
}) {
  const { t, i18n } = useTranslation()
  const { context } = usePosSession()
  const confirm = useConfirm()
  const pending = useKitchenVoidRequests(branchId, 'pending')
  const handled = useKitchenVoidRequests(branchId, 'handled')
  const decide = useDecideVoidRequest()
  const [notice, setNotice] = useState<string | null>(null)
  const zone = branchTimeZone(context.data)
  const shown = group === 'pending' ? pending : handled
  const rows = shown.data?.data ?? []
  const handledRows = handled.data?.data ?? []
  const count = (status: string) => handledRows.filter((row) => row.status === status).length
  const reason = (code: string | null) => {
    if (!code) return '—'
    const key = `branchKitchen.voidReason_${code}`
    return i18n.exists(key) ? t(key) : code.replace(/_/g, ' ')
  }

  async function act(row: KitchenVoidRequest, decision: 'grant' | 'decline') {
    if (decide.isPending) return
    if (
      decision === 'decline' &&
      !(await confirm({
        message: t('kitchenBoard.voids.confirmDecline', { subject: row.subject_label ?? '' }),
        variant: 'destructive',
        confirmLabel: t('kitchenBoard.voids.decline'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setNotice(null)
    decide.mutate(
      { id: row.id, decision },
      { onError: (failure) => setNotice(describeFailure(failure, t, 'kitchenBoard.voids.failed')) },
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-base text-muted-foreground">{t('kitchenBoard.voids.intro')}</p>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ['pending', pending.data?.meta.count ?? 0],
          ['granted', count('granted')],
          ['declined', count('declined')],
        ].map(([key, value]) => (
          <div key={key} className="rounded-lg border bg-card p-3">
            <dt className="text-sm text-muted-foreground">
              {t(`kitchenBoard.voids.count_${key}`)}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Tabs
        value={group}
        onValueChange={(value) => onGroup(value === 'handled' ? 'handled' : 'pending')}
      >
        <TabsList>
          <TabsTrigger value="pending">{t('kitchenBoard.voids.pending')}</TabsTrigger>
          <TabsTrigger value="handled">{t('kitchenBoard.voids.handled')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {notice && (
        <p role="alert" className="text-destructive">
          {notice}
        </p>
      )}
      {shown.isError ? (
        <div role="alert" className="flex items-center gap-3 text-destructive">
          {describeFailure(shown.error, t, 'kitchenBoard.loadFailed')}
          <Button type="button" variant="outline" size="sm" onClick={() => void shown.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : shown.isPending ? (
        <p role="status" className="text-muted-foreground">
          {t('waiting')}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t('kitchenBoard.voids.empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">{row.subject_label || t('kitchenBoard.noTitle')}</p>
                <p className="text-sm">
                  {t('kitchenBoard.voids.reason')}: {reason(row.reason)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    row.requester_name,
                    formatInstant(row.created_at, i18n.language, zone),
                    row.status !== 'pending' && row.decided_by_name
                      ? t('kitchenBoard.voids.decidedBy', { name: row.decided_by_name })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {row.status === 'pending' ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => void act(row, 'decline')}
                  >
                    <XIcon />
                    {t('kitchenBoard.voids.decline')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => void act(row, 'grant')}
                  >
                    <CheckIcon />
                    {t('kitchenBoard.voids.grant')}
                  </Button>
                </div>
              ) : (
                <Badge variant={row.status === 'granted' ? 'success' : 'secondary'}>
                  {t(`kitchenBoard.voids.status_${row.status}`)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
