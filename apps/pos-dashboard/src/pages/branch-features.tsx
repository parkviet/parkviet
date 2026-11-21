import { branchSettingVisible } from '@parkviet/pos-shared/module-registry'
import { POS_FEATURES, type PosFeature } from '@parkviet/pos-shared/pos-features'
import { describeFailure, failureStatus, posFailureKey } from '@parkviet/pos-shared/request-failure'
import type { PosBranch } from '@parkviet/pos-shared/types/pos-context'
import { usePermissions, useStore } from '@spree/dashboard-core'
import {
  ListChecksIcon,
  ReceiptTextIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  StoreIcon,
} from '@spree/dashboard-ui/icons'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SalesDraftProvider, SalesFields, SalesSaveBar } from '../components/branch-auto-print'
import { useBranchScope } from '../components/branch-detail'
import { BranchLabelFormats } from '../components/branch-label-formats'
import { BranchSellingPreset } from '../components/branch-selling-preset'
import {
  type FeatureChange,
  FeatureSwitchRow,
  featureChangeText,
} from '../components/feature-switch-row'
import { SectionNav } from '../components/section-nav'
import { ModelCard, ModelNotice, ModelState } from '../components/setup/model-ui'
import { ToggleRow } from '../components/toggle-row'
import { setFeature, useBranchFeatures } from '../hooks/use-branch-features'
import { useKioskSettings, useKioskWrite } from '../hooks/use-kiosk-settings'
import { refreshBusinessModel } from '../hooks/use-onboarding'
import { usePosSession } from '../hooks/use-pos-session'
import { routeAllowed } from '../lib/pos-access'
import { BranchModuleSwitches } from './business-model'

const RULE_FEATURES = [
  'credit',
  'quick_credit',
  'returns',
  'refunds',
  'exchanges',
  'cash_moves',
  'edit_lease',
  'traceability',
  'exports',
] as const satisfies readonly PosFeature[]
const UTILITY_FEATURES = [
  'delivery',
  'vietqr',
  'customer_display',
] as const satisfies readonly PosFeature[]
const ORDER_FEATURES = ['qr_order'] as const satisfies readonly PosFeature[]

// Industry modules (which setup screens exist) and operational feature flags
// (which risky actions may start), plus the scale label formats this branch
// reads while measured goods are on.
export function BranchFeaturesTab() {
  const { t } = useTranslation()
  const { permissionKeys } = usePermissions()
  const { context } = usePosSession()
  const { branch, access, branchWrite, modules, storeId } = useBranchScope()
  const sections = [
    ['features-flow', 'flow'],
    ['features-rules', 'rules'],
    ['features-display', 'display'],
    ['features-utilities', 'utilities'],
    ['features-orders', 'orders'],
  ].map(([id, key]) => ({ id, label: t(`featuresSections.${key}`) }))
  sections.push({ id: 'features-selling', label: t('branchSellingPreset.title') })
  const measured = branchSettingVisible({ ...context.data, modules }, 'label-formats')
  const printingAllowed = routeAllowed('branch-printing', { permissionKeys, context: context.data })
  return (
    <SalesDraftProvider branch={branch} storeId={storeId} canWrite={branchWrite || access.write}>
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-6">
          <ModelCard title={t('featuresSections.flow')} id="features-flow" icon={<StoreIcon />}>
            <p className="text-sm text-muted-foreground">{t('featuresSections.flowIntro')}</p>
            <BranchModuleSwitches
              key={`modules-${branch.id}`}
              branch={branch}
              storeId={storeId}
              write={branchWrite}
              framed={false}
            />
            {measured ? (
              <BranchLabelFormats
                key={`labels-${branch.id}`}
                branchId={branch.id}
                write={access.write}
              />
            ) : null}
            <SetupLink
              storeId={storeId}
              branchId={branch.id}
              tab="kitchen"
              label={t('branchTabs.kitchen')}
            />
          </ModelCard>
          <ModelCard
            title={t('featuresSections.rules')}
            id="features-rules"
            icon={<SlidersHorizontalIcon />}
          >
            <p className="text-sm text-muted-foreground">{t('featuresSections.rulesIntro')}</p>
            <FeatureList features={RULE_FEATURES} listLabel={t('branchFeaturesList')} />
            <SalesFields keys={['allow_oversell', 'warn_below_cost']} />
          </ModelCard>
          <ModelCard
            title={t('featuresSections.display')}
            id="features-display"
            icon={<SettingsIcon />}
          >
            <p className="text-sm text-muted-foreground">{t('featuresSections.displayIntro')}</p>
            <SalesFields keys={['show_stock', 'show_cost', 'cart_order', 'inline_variants']} />
          </ModelCard>
          <ModelCard
            title={t('featuresSections.utilities')}
            id="features-utilities"
            icon={<ListChecksIcon />}
          >
            <p className="text-sm text-muted-foreground">{t('featuresSections.utilitiesIntro')}</p>
            <FeatureList features={UTILITY_FEATURES} listLabel={t('featuresSections.utilities')} />
            <SalesFields keys={['order_note', 'coupons', 'payment_chime']} />
          </ModelCard>
          <p className="text-sm text-muted-foreground">
            {printingAllowed ? (
              <Link
                to={`/${storeId}/branches/${branch.id}/printing` as string}
                hash="printing-auto"
                className="underline"
              >
                {t('branchPrinting.movedFromFeatures')}
              </Link>
            ) : (
              t('branchPrinting.movedFromFeatures')
            )}
          </p>
          <ModelCard
            title={t('featuresSections.orders')}
            id="features-orders"
            icon={<ReceiptTextIcon />}
          >
            <p className="text-sm text-muted-foreground">{t('featuresSections.ordersIntro')}</p>
            <FeatureList features={ORDER_FEATURES} listLabel={t('featuresSections.orders')} />
            <SalesFields keys={['scheduled_delivery']} />
            <QrModeField />
            <KioskKitchenField />
          </ModelCard>
          <BranchSellingPreset />
          <SalesSaveBar />
        </div>
        <SectionNav sections={sections} />
      </div>
    </SalesDraftProvider>
  )
}

function SetupLink({
  storeId,
  branchId,
  tab,
  label,
}: {
  storeId: string
  branchId: string
  tab: string
  label: string
}) {
  return (
    <p className="text-sm">
      <Link to={`/${storeId}/branches/${branchId}/${tab}` as string} className="underline">
        {label}
      </Link>
    </p>
  )
}

function FeatureList({
  features,
  listLabel,
}: {
  features: readonly PosFeature[]
  listLabel?: string
}) {
  const { branch, access, branchWrite } = useBranchScope()
  return (
    <BranchFeatures
      key={features.join('-')}
      branch={branch}
      storeWrite={access.write}
      branchWrite={branchWrite}
      features={features}
      listLabel={listLabel}
      bare
    />
  )
}

function BranchFeatures({
  branch,
  storeWrite,
  branchWrite,
  features = POS_FEATURES,
  bare = false,
  listLabel,
}: {
  branch: PosBranch
  storeWrite: boolean
  branchWrite: boolean
  features?: readonly PosFeature[]
  bare?: boolean
  listLabel?: string
}) {
  const { t } = useTranslation()
  const { storeId } = useStore()
  const mutation = useMutation({
    mutationFn: (input: { change: FeatureChange; reason: string }) =>
      setFeature(
        input.change.feature,
        input.change.enabled,
        input.reason,
        input.change.scope === 'branch' ? branch.id : undefined,
      ),
  })
  const flags = useBranchFeatures(branch.id, true)
  const [change, setChange] = useState<FeatureChange | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  async function save() {
    const note = reason.trim()
    if (
      !change ||
      !note ||
      busy ||
      (change.scope === 'store'
        ? !storeWrite
        : !branchWrite || (change.enabled !== false && !storeWrite))
    )
      return
    setBusy(true)
    setNotice(null)
    try {
      await mutation.mutateAsync({ change, reason: note })
      setNotice({
        text: t(featureChangeText(change, 'saved'), { name: t(`featureName_${change.feature}`) }),
        failed: false,
      })
      setChange(null)
    } catch (error) {
      setNotice({ text: describeFailure(error, t), failed: true })
    } finally {
      try {
        await refreshBusinessModel(storeId)
      } finally {
        setBusy(false)
      }
    }
  }
  const list = (
    <>
      {!storeWrite && !branchWrite ? (
        <p>{t('featureReadOnly')}</p>
      ) : !storeWrite ? (
        <p>{t('featureBranchOnly')}</p>
      ) : null}
      <ModelNotice notice={notice} />
      {flags.isPending ? (
        <ModelState title={t('waiting')} />
      ) : flags.isError ? (
        <ModelState
          error
          title={t(
            failureStatus(flags.error) === 404
              ? 'branchFeaturesUnsupported'
              : posFailureKey(flags.error),
          )}
          retry={failureStatus(flags.error) === 404 ? undefined : () => void flags.refetch()}
        />
      ) : null}
      {flags.data && !flags.isError ? (
        <ul className="divide-y" aria-label={listLabel ?? t('branchFeaturesList')}>
          {features.map((feature) => (
            <FeatureSwitchRow
              key={feature}
              feature={feature}
              flags={flags.data}
              timeZone={branch.timezone}
              storeWrite={storeWrite}
              branchWrite={branchWrite}
              busy={busy}
              change={change?.feature === feature ? change : null}
              reason={reason}
              onStart={(next) => {
                setNotice(null)
                setReason('')
                setChange(next)
              }}
              onReason={setReason}
              onCancel={() => setChange(null)}
              onSave={() => void save()}
            />
          ))}
        </ul>
      ) : null}
    </>
  )
  if (bare) return list
  return (
    <ModelCard
      title={t('branchFeaturesTitle')}
      id="branch-features-heading"
      icon={<SlidersHorizontalIcon />}
    >
      {list}
    </ModelCard>
  )
}

function QrModeField() {
  const { t } = useTranslation()
  const { branch, modules, storeId } = useBranchScope()
  if (modules?.['fnb.qr_order'] !== true) return null
  return <SetupLink storeId={storeId} branchId={branch.id} tab="emenu" label={t('emenu.moved')} />
}

function KioskKitchenField() {
  const { t } = useTranslation()
  const { branch, access, modules } = useBranchScope()
  const on = modules?.['fnb.kiosk'] === true
  const settings = useKioskSettings(branch.id, on)
  const write = useKioskWrite()
  if (!on || !settings.data) return null
  return (
    <ToggleRow
      checked={settings.data.kiosk_kitchen_before_payment}
      disabled={!access.write || write.isPending}
      switchLabel={t('kiosk.kitchenBeforePayment')}
      onChange={(value) =>
        void write.mutateAsync({
          method: 'PUT',
          path: '/pos/kiosk_settings',
          body: { branch_id: branch.id, kiosk_kitchen_before_payment: value },
        })
      }
      label={t('kiosk.kitchenBeforePayment')}
      description={t('kiosk.kitchenBeforePaymentHint')}
    />
  )
}
