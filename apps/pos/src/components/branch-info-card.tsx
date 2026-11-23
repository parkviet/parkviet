import { describeFailure } from '@shared/request-failure'
import { Button, Input, Label } from '@spree/dashboard-ui'
import { Building2Icon } from '@spree/dashboard-ui/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveBranchInfo, useBranchInfo } from '../hooks/use-store-info'
import { ModelCard, ModelNotice } from './setup/model-ui'

type Field = { value: string | null; source: string | null }

function field(source: unknown, key: string): Field {
  const row = (typeof source === 'object' && source !== null ? source : {}) as Record<
    string,
    unknown
  >
  const item = row[key]
  if (typeof item !== 'object' || item === null) return { value: null, source: null }
  const record = item as { value?: unknown; source?: unknown }
  return {
    value: typeof record.value === 'string' ? record.value : null,
    source: typeof record.source === 'string' ? record.source : null,
  }
}

// Overrides of the store's POS details. An empty field means "use the store".
export function BranchInfoCard({ branchId, write }: { branchId: string; write: boolean }) {
  const { t } = useTranslation()
  const query = useBranchInfo(branchId, true)
  const data = (query.data ?? {}) as {
    overrides?: Record<string, string | null>
    effective?: unknown
    business_day_cutoff?: string | null
    open_shifts?: number
  }
  const effectiveName = field(data.effective, 'name')
  const [name, setName] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [cutoff, setCutoff] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const shownName = name ?? data.overrides?.name ?? ''
  const shownPhone = phone ?? data.overrides?.phone ?? ''
  const shownCutoff = cutoff ?? data.business_day_cutoff ?? ''
  if (query.isPending) return null
  if (query.isError) return null
  async function save() {
    setNotice(null)
    try {
      await saveBranchInfo(branchId, {
        name: shownName.trim() || null,
        phone: shownPhone.trim() || null,
        business_day_cutoff: shownCutoff.trim() || null,
      })
      setName(null)
      setPhone(null)
      setCutoff(null)
      await query.refetch()
      setNotice({ text: t('storeInfo.saved'), failed: false })
    } catch (error) {
      setNotice({ text: describeFailure(error, t), failed: true })
    }
  }
  return (
    <ModelCard title={t('storeInfo.title')} id="branch-store-info" icon={<Building2Icon />}>
      <ModelNotice notice={notice} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="branch-info-name">{t('storeInfo.name')}</Label>
          <Input
            id="branch-info-name"
            value={shownName}
            placeholder={effectiveName.value ?? ''}
            disabled={!write}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {shownName ? t('storeInfo.customize') : t('storeInfo.inherit')}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch-info-phone">{t('storeInfo.phone')}</Label>
          <Input
            id="branch-info-phone"
            value={shownPhone}
            disabled={!write}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch-info-cutoff">{t('storeInfo.cutoff')}</Label>
          <Input
            id="branch-info-cutoff"
            type="time"
            value={shownCutoff}
            disabled={!write}
            onChange={(event) => setCutoff(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">{t('storeInfo.cutoffHelp')}</p>
          {data.open_shifts ? <p className="text-sm">{t('storeInfo.openShifts')}</p> : null}
        </div>
      </div>
      {write ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setName('')
              setPhone('')
              setCutoff('')
            }}
          >
            {t('storeInfo.useStore')}
          </Button>
          <Button type="button" onClick={() => void save()}>
            {t('storeInfo.save')}
          </Button>
        </div>
      ) : null}
    </ModelCard>
  )
}
