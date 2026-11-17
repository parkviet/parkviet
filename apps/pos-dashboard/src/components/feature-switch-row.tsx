import {
  type BranchFeatures,
  branchOverride,
  offReason,
  type PosFeature,
} from '@parkviet/pos-shared/pos-features'
import { Button, Input, Label } from '@spree/dashboard-ui'
import { useTranslation } from 'react-i18next'
import { modelDate as formatInZone } from './setup/model-ui'
import { ToggleRow } from './toggle-row'

export type FeatureChange = {
  feature: PosFeature
  scope: 'store' | 'branch'
  enabled: boolean | null
}
export function featureChangeText(change: FeatureChange, kind: 'confirm' | 'saved') {
  const action =
    change.scope === 'store'
      ? change.enabled
        ? 'StoreOn'
        : 'StoreOff'
      : change.enabled === null
        ? 'BranchRestore'
        : 'BranchOff'
  return `feature${kind === 'confirm' ? 'Confirm' : 'Saved'}${action}`
}

export function FeatureSwitchRow({
  feature,
  flags,
  timeZone,
  storeWrite,
  branchWrite,
  busy,
  change,
  reason,
  onStart,
  onReason,
  onCancel,
  onSave,
}: {
  feature: PosFeature
  flags: BranchFeatures
  timeZone: string
  storeWrite: boolean
  branchWrite: boolean
  busy: boolean
  change: FeatureChange | null
  reason: string
  onStart: (change: FeatureChange) => void
  onReason: (value: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  const { t, i18n } = useTranslation()
  const on = flags.features[feature] === true
  const storeOn = flags.store_defaults[feature] === true
  const branchOff = branchOverride(flags, feature) === false
  const why = offReason(flags, feature)
  const name = t(`featureName_${feature}`)
  const latest = [...flags.settings]
    .filter((row) => row.feature === feature)
    .sort((a, b) => (b.changed_at ?? '').localeCompare(a.changed_at ?? ''))[0]
  const reasonId = `feature-reason-${feature}`
  // One switch for the next change a person here is allowed to make.
  // Store-wide off stays a quiet text action when the switch turns the branch off.
  const next = !storeOn
    ? storeWrite
      ? { scope: 'store' as const, enabled: true, label: t('featureStoreTurnOn', { name }) }
      : null
    : !branchOff && branchWrite
      ? { scope: 'branch' as const, enabled: false, label: t('featureBranchTurnOff', { name }) }
      : branchOff && storeWrite
        ? { scope: 'branch' as const, enabled: null, label: t('featureBranchRestore', { name }) }
        : storeWrite
          ? { scope: 'store' as const, enabled: false, label: t('featureStoreTurnOff', { name }) }
          : null
  const storeOff =
    storeWrite && storeOn && next?.scope !== 'store'
      ? { scope: 'store' as const, enabled: false, label: t('featureStoreTurnOff', { name }) }
      : null
  return (
    <li data-feature={feature}>
      <ToggleRow
        checked={on}
        disabled={busy || Boolean(change) || !next}
        switchLabel={next?.label ?? name}
        onChange={
          next && !change
            ? () => onStart({ feature, scope: next.scope, enabled: next.enabled })
            : undefined
        }
        label={name}
        description={
          <>
            <p>{t(`featureHint_${feature}`)}</p>
            <p>
              {on
                ? t('featureStatusOn')
                : t(why === 'branch' ? 'featureOffByBranch' : 'featureOffByStore')}
              {' · '}
              {t('featureStoreState', {
                state: t(storeOn ? 'featureStatusOn' : 'featureStatusOff'),
              })}
              {' · '}
              {t(branchOff ? 'featureBranchOffState' : 'featureBranchFollows')}
            </p>
            {latest ? (
              <p>
                {t('featureLastChange', {
                  name: latest.changed_by_name ?? '—',
                  at: formatInZone(latest.changed_at, i18n.language, timeZone),
                  reason: latest.reason,
                })}
              </p>
            ) : null}
          </>
        }
        extra={
          storeOff && !change ? (
            <button
              type="button"
              className="text-sm text-muted-foreground underline"
              disabled={busy}
              onClick={() => onStart({ feature, scope: 'store', enabled: false })}
            >
              {storeOff.label}
            </button>
          ) : null
        }
      >
        {change ? (
          <form
            className="flex w-full flex-col gap-3 rounded-md bg-muted p-4"
            aria-label={t('featureChangeFor', { name })}
            onSubmit={(event) => {
              event.preventDefault()
              onSave()
            }}
          >
            <p id={`${reasonId}-hint`}>{t(featureChangeText(change, 'confirm'), { name })}</p>
            <Label htmlFor={reasonId}>{t('featureReason')}</Label>
            <Input
              id={reasonId}
              value={reason}
              maxLength={200}
              required
              autoComplete="off"
              aria-describedby={`${reasonId}-hint`}
              disabled={busy}
              autoFocus
              onChange={(event) => onReason(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant={change.enabled === false ? 'destructive' : 'default'}
                disabled={busy || !reason.trim()}
              >
                {busy ? t('waiting') : t('featureSave')}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                {t('adminCancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </ToggleRow>
    </li>
  )
}
