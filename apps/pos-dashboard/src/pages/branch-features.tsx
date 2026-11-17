import { branchSettingVisible } from '@parkviet/pos-shared/module-registry'
import { POS_FEATURES, type PosFeature } from '@parkviet/pos-shared/pos-features'
import { describeFailure, failureStatus, posFailureKey } from '@parkviet/pos-shared/request-failure'
import { normalizeSalesSettings, type SalesSettings } from '@parkviet/pos-shared/sales-settings'
import type { PosBranch } from '@parkviet/pos-shared/types/pos-context'
import { useStore } from '@spree/dashboard-core'
import { Button } from '@spree/dashboard-ui'
import {
  ListChecksIcon,
  PrinterIcon,
  ReceiptTextIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  StoreIcon,
} from '@spree/dashboard-ui/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBranchScope } from '../components/branch-detail'
import { BranchLabelFormats } from '../components/branch-label-formats'
import {
  type FeatureChange,
  FeatureSwitchRow,
  featureChangeText,
} from '../components/feature-switch-row'
import { SectionNav } from '../components/section-nav'
import { ModelCard, ModelNotice, ModelSelect, ModelState } from '../components/setup/model-ui'
import { ToggleRow } from '../components/toggle-row'
import { setFeature, useBranchFeatures } from '../hooks/use-branch-features'
import { QR_ORDER_MODES, useTableSettings } from '../hooks/use-floor-plan'
import { useKioskSettings, useKioskWrite } from '../hooks/use-kiosk-settings'
import { useKitchenSettings, useKitchenWrite } from '../hooks/use-kitchen'
import { refreshBusinessModel } from '../hooks/use-onboarding'
import { usePosSession } from '../hooks/use-pos-session'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
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
  const { context } = usePosSession()
  const { branch, access, branchWrite, modules, storeId } = useBranchScope()
  const sections = [
    ['features-flow', 'flow'],
    ['features-rules', 'rules'],
    ['features-display', 'display'],
    ['features-utilities', 'utilities'],
    ['features-auto-print', 'print'],
    ['features-orders', 'orders'],
  ].map(([id, key]) => ({ id, label: t(`featuresSections.${key}`) }))
  const measured = branchSettingVisible({ ...context.data, modules }, 'label-formats')
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
            <SalesFields keys={['show_stock', 'show_cost', 'cart_order']} />
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
          <ModelCard
            title={t('featuresSections.print')}
            id="features-auto-print"
            icon={<PrinterIcon />}
          >
            <p className="text-sm text-muted-foreground">{t('featuresSections.printIntro')}</p>
            <KitchenTrigger />
            <SalesFields keys={['auto_print_receipt']} />
            <CupAutoPrint />
          </ModelCard>
          <ModelCard
            title={t('featuresSections.orders')}
            id="features-orders"
            icon={<ReceiptTextIcon />}
          >
            <p className="text-sm text-muted-foreground">{t('featuresSections.ordersIntro')}</p>
            <FeatureList features={ORDER_FEATURES} listLabel={t('featuresSections.orders')} />
            <QrModeField />
            <KioskKitchenField />
          </ModelCard>
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

type SalesKey = keyof SalesSettings
const SalesDraft = createContext<{
  draft: SalesSettings
  base: SalesSettings
  set: (patch: Partial<SalesSettings>) => void
  save: () => void
  reset: () => void
  busy: boolean
  canWrite: boolean
  notice: { text: string; failed: boolean } | null
} | null>(null)

function useSalesDraft() {
  const value = useContext(SalesDraft)
  if (!value) throw new Error('sales draft is missing')
  return value
}

function SalesDraftProvider({
  branch,
  storeId,
  canWrite,
  children,
}: {
  branch: PosBranch
  storeId: string
  canWrite: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const saved = JSON.stringify(branch.sales_settings ?? {})
  const base = normalizeSalesSettings(branch.sales_settings)
  const [draft, setDraft] = useState(base)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  useEffect(() => {
    setDraft(normalizeSalesSettings(JSON.parse(saved) as unknown))
  }, [saved])
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  async function save() {
    if (!dirty || busy || !canWrite) return
    setBusy(true)
    setNotice(null)
    try {
      await posRequest('PUT', `/pos/branches/${branch.id}/sales_settings`, { body: draft })
      await client.invalidateQueries({ queryKey: posKey(storeId, 'branches') })
      await refreshBusinessModel(storeId)
      setNotice({ text: t('saved'), failed: false })
    } catch (error) {
      setNotice({ text: describeFailure(error, t), failed: true })
    } finally {
      setBusy(false)
    }
  }
  return (
    <SalesDraft.Provider
      value={{
        draft,
        base,
        set: (patch) => setDraft((current) => ({ ...current, ...patch })),
        save: () => void save(),
        reset: () => setDraft(base),
        busy,
        canWrite,
        notice,
      }}
    >
      {children}
    </SalesDraft.Provider>
  )
}

function SalesFields({ keys }: { keys: SalesKey[] }) {
  const { t } = useTranslation()
  const { draft, set, canWrite, busy } = useSalesDraft()
  return (
    <div className="space-y-4">
      {keys.map((key) => {
        if (key === 'cart_order')
          return (
            <ModelSelect
              key={key}
              label={t('salesCartOrder')}
              value={draft.cart_order}
              disabled={!canWrite || busy}
              options={[
                { value: 'oldest_first', label: t('salesCartOldest') },
                { value: 'newest_first', label: t('salesCartNewest') },
              ]}
              onChange={(value) =>
                set({ cart_order: value === 'newest_first' ? 'newest_first' : 'oldest_first' })
              }
            />
          )
        if (key === 'payment_chime')
          return (
            <ModelSelect
              key={key}
              label={t('salesChime')}
              value={draft.payment_chime}
              disabled={!canWrite || busy}
              options={[
                { value: 'default', label: t('salesChimeDefault') },
                { value: 'off', label: t('salesChimeOff') },
              ]}
              onChange={(value) => set({ payment_chime: value === 'off' ? 'off' : 'default' })}
            />
          )
        const label = {
          allow_oversell: 'salesAllowOversell',
          warn_below_cost: 'salesWarnBelowCost',
          show_stock: 'salesShowStock',
          show_cost: 'salesShowCost',
          order_note: 'salesOrderNote',
          coupons: 'salesCoupons',
          auto_print_receipt: 'salesAutoPrint',
        }[key]
        const hint = {
          allow_oversell: 'salesAllowOversellHint',
          warn_below_cost: 'salesWarnBelowCostHint',
          show_stock: 'salesShowStockHint',
          show_cost: 'salesShowCostHint',
          order_note: 'salesOrderNoteHint',
          coupons: 'salesCouponsHint',
          auto_print_receipt: 'salesAutoPrintHint',
        }[key]
        if (!label) return null
        return (
          <div key={key}>
            <ToggleRow
              checked={draft[key] === true}
              disabled={!canWrite || busy}
              switchLabel={t(label)}
              onChange={(value) => set({ [key]: value })}
              label={t(label)}
              description={hint ? t(hint) : undefined}
              extra={
                key === 'allow_oversell' ? <p role="note">{t('salesAllowOversellWarn')}</p> : null
              }
            />
          </div>
        )
      })}
    </div>
  )
}

function SalesSaveBar() {
  const { t } = useTranslation()
  const { draft, base, save, reset, busy, canWrite, notice } = useSalesDraft()
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)
  if (!dirty && !notice) return null
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-md border bg-background p-3">
      <ModelNotice notice={notice} />
      {dirty && canWrite ? (
        <>
          <Button type="button" disabled={busy} onClick={save}>
            {busy ? t('waiting') : t('salesSave')}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={reset}>
            {t('salesDiscard')}
          </Button>
        </>
      ) : null}
    </div>
  )
}

function KitchenTrigger() {
  const { t } = useTranslation()
  const { branch, access } = useBranchScope()
  const settings = useKitchenSettings(branch.id)
  const write = useKitchenWrite()
  if (!settings.data) return null
  return (
    <ModelSelect
      label={t('branchKitchen.trigger')}
      value={settings.data.kitchen_send_trigger}
      disabled={!access.write || write.isPending}
      options={[
        { value: 'on_complete', label: t('branchKitchen.trigger_on_complete') },
        { value: 'manual', label: t('branchKitchen.trigger_manual') },
      ]}
      onChange={(value) =>
        void write.mutateAsync({
          method: 'PUT',
          path: '/pos/kitchen_settings',
          body: { branch_id: branch.id, kitchen_send_trigger: value },
        })
      }
    />
  )
}

function QrModeField() {
  const { t } = useTranslation()
  const { branch, access, modules } = useBranchScope()
  const settings = useTableSettings(branch.id)
  if (modules?.['fnb.qr_order'] !== true || !settings.data) return null
  return (
    <ModelSelect
      label={t('floorPlan.qrOrderMode')}
      value={settings.data.qr_order_mode}
      disabled={!access.write}
      options={QR_ORDER_MODES.map((mode) => ({
        value: mode,
        label: t(`floorPlan.qrMode_${mode}`),
      }))}
      onChange={(mode) =>
        void posRequest('PUT', '/pos/table_settings', {
          body: { branch_id: branch.id, qr_order_mode: mode },
          idempotencyKey: crypto.randomUUID(),
        })
      }
    />
  )
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

function CupAutoPrint() {
  const { t } = useTranslation()
  const { branch, access } = useBranchScope()
  const write = useKitchenWrite()
  const [on, setOn] = useState(true)
  return (
    <ToggleRow
      checked={on}
      disabled={!access.write || write.isPending}
      switchLabel={t('salesCupAutoPrint')}
      onChange={(value) => {
        setOn(value)
        void write.mutateAsync({
          method: 'PUT',
          path: '/pos/cup_label_settings',
          body: { branch_id: branch.id, auto_print: value },
        })
      }}
      label={t('salesCupAutoPrint')}
      description={t('salesCupAutoPrintHint')}
    />
  )
}
