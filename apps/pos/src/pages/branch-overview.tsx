import { describeFailure } from '@shared/request-failure'
import { Badge, Button } from '@spree/dashboard-ui'
import { InfoIcon, StarIcon } from '@spree/dashboard-ui/icons'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBranchScope } from '../components/branch-detail'
import { BranchInfoCard } from '../components/branch-info-card'
import { ModelCard, ModelNotice } from '../components/setup/model-ui'
import { useStoreWrite } from '../hooks/use-master-data'
import { usePosSession } from '../hooks/use-pos-session'
import { useLocationOptions } from '../hooks/use-topology'
import { BranchBusinessModel } from './business-model'

// What a branch is set up with, and its business model.
export function BranchOverviewTab() {
  const { t } = useTranslation()
  const { context } = usePosSession()
  const { branch, access, branchWrite } = useBranchScope()
  const locations = useLocationOptions(access.read)
  const location = (id: string | null | undefined) =>
    id ? (locations.data?.data.find((row) => row.id === id)?.name ?? '—') : null
  const write = useStoreWrite()
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const disabled = branch.status !== 'active'
  async function makeDefault() {
    if (write.isPending) return
    setNotice(null)
    try {
      await write.mutateAsync({
        method: 'PATCH',
        path: `/pos/branches/${branch.id}`,
        body: { is_default: true },
      })
      setNotice({ text: t('branchDefaultSet', { name: branch.name }), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }
  const rows: [string, ReactNode][] = [
    ['code', branch.code],
    ['timezone', branch.timezone],
    ['businessDayCutoff', (branch.business_day_cutoff ?? '04:00').slice(0, 5)],
    ...(access.read
      ? ([
          ['stockLocation', location(branch.stock_location_id) ?? '—'],
          [
            'adminReceivingWarehouse',
            location(branch.receiving_stock_location_id) ?? t('adminDefaultWarehouse'),
          ],
        ] as [string, ReactNode][])
      : []),
    ['adminReturnWindow', branch.return_window_days ?? '—'],
    ['adminVarianceThreshold', branch.variance_threshold ?? '—'],
    ['adminAdjustmentThreshold', branch.adjustment_approval_threshold ?? '—'],
    ['adminReceivingNote', branch.receiving_note || '—'],
  ]
  return (
    <div className="space-y-6">
      <BranchInfoCard branchId={branch.id} write={branchWrite || access.write} />
      <ModelCard title={t('branchOverviewInfo')} id="branch-overview-info" icon={<InfoIcon />}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-muted-foreground">{t(label)}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </ModelCard>
      <ModelCard title={t('branchDefaultTitle')} id="branch-default" icon={<StarIcon />}>
        <p className="text-sm text-muted-foreground">{t('branchDefaultHint')}</p>
        <ModelNotice notice={notice} />
        {branch.is_default ? (
          <Badge variant="success" className="w-fit">
            {t('branchIsDefault')}
          </Badge>
        ) : (
          access.write && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || write.isPending}
                onClick={() => void makeDefault()}
              >
                {t('branchSetDefault')}
              </Button>
              {disabled && (
                <p className="text-sm text-muted-foreground">{t('branchDefaultDisabled')}</p>
              )}
            </div>
          )
        )}
      </ModelCard>
      <BranchBusinessModel
        key={branch.id}
        branch={{ ...branch, profile_key: branch.profile_key ?? context.data?.profile?.key }}
        storeId={context.data?.store.id ?? null}
        storeWrite={access.write}
      />
    </div>
  )
}
