import { isSheetPaper } from '@shared/paper-size'
import { describeFailure } from '@shared/request-failure'
import { normalizeSalesSettings, type SalesSettings } from '@shared/sales-settings'
import type { PosBranch } from '@shared/types/pos-context'
import { usePermissions } from '@spree/dashboard-core'
import { Button } from '@spree/dashboard-ui'
import { SlidersHorizontalIcon } from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useCupLabelSettings,
  useKitchenSettings,
  useKitchenStations,
  useKitchenWrite,
} from '../hooks/use-kitchen'
import { useBranchReceiptTemplates } from '../hooks/use-master-data'
import { refreshBusinessModel } from '../hooks/use-onboarding'
import { usePosSession } from '../hooks/use-pos-session'
import { canManageKitchen, hasCapability } from '../lib/pos-access'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useBranchScope } from './branch-detail'
import { ModelCard, ModelNotice, ModelSelect } from './setup/model-ui'
import { ToggleRow } from './toggle-row'

export type SalesKey = keyof SalesSettings

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

export function useSalesDraft() {
  const value = useContext(SalesDraft)
  if (!value) throw new Error('sales draft is missing')
  return value
}

export function SalesDraftProvider({
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

export function SalesFields({
  keys,
  extraFor,
}: {
  keys: SalesKey[]
  extraFor?: (key: SalesKey, draft: SalesSettings) => ReactNode
}) {
  const { t } = useTranslation()
  const { draft, set, canWrite, busy } = useSalesDraft()
  const { modules } = useBranchScope()
  const kitchenOff = modules != null && modules['fnb.kitchen'] !== true
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
        const label: Partial<Record<SalesKey, string>> = {
          allow_oversell: 'salesAllowOversell',
          warn_below_cost: 'salesWarnBelowCost',
          show_stock: 'salesShowStock',
          show_cost: 'salesShowCost',
          order_note: 'salesOrderNote',
          coupons: 'salesCoupons',
          auto_print_receipt: 'salesAutoPrint',
          inline_variants: 'salesInlineVariants',
          scheduled_delivery: 'salesScheduledDelivery',
          auto_print_prebill: 'salesAutoPrintPrebill',
          print_void_tickets: 'salesPrintVoidTickets',
          auto_print_ready_ticket: 'salesAutoPrintReadyTicket',
          allow_sheet_receipts: 'salesAllowSheetReceipts',
        }
        const hint: Partial<Record<SalesKey, string>> = {
          allow_oversell: 'salesAllowOversellHint',
          warn_below_cost: 'salesWarnBelowCostHint',
          show_stock: 'salesShowStockHint',
          show_cost: 'salesShowCostHint',
          order_note: 'salesOrderNoteHint',
          coupons: 'salesCouponsHint',
          auto_print_receipt: 'salesAutoPrintHint',
          inline_variants: 'salesInlineVariantsHint',
          scheduled_delivery: 'salesScheduledDeliveryHint',
          auto_print_prebill: 'salesAutoPrintPrebillHint',
          print_void_tickets: 'salesPrintVoidTicketsHint',
          auto_print_ready_ticket: 'salesAutoPrintReadyTicketHint',
          allow_sheet_receipts: 'salesAllowSheetReceiptsHint',
        }
        const labelKey = label[key]
        const hintKey = hint[key]
        if (!labelKey) return null
        const needsKitchen = key === 'print_void_tickets' && kitchenOff
        const customExtra = extraFor?.(key, draft)
        return (
          <div key={key}>
            <ToggleRow
              checked={draft[key] === true}
              disabled={!canWrite || busy || needsKitchen}
              switchLabel={t(labelKey)}
              onChange={(value) => set({ [key]: value })}
              label={t(labelKey)}
              description={hintKey ? t(hintKey) : undefined}
              extra={
                needsKitchen ? (
                  <p role="note">{t('salesPrintVoidTicketsNeedsKitchen')}</p>
                ) : key === 'allow_oversell' ? (
                  <p role="note">{t('salesAllowOversellWarn')}</p>
                ) : (
                  (customExtra ?? null)
                )
              }
            />
          </div>
        )
      })}
    </div>
  )
}

export function SalesSaveBar() {
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

// Per-branch automatic printing options: when kitchen orders go out, automatic
// pre-bill / receipt / void tickets, and automatic cup labels.
export function BranchAutoPrint() {
  const { t } = useTranslation()
  const { branch, access, branchWrite, modules } = useBranchScope()
  const { permissionKeys } = usePermissions()
  const { context } = usePosSession()
  const posAccess = { permissionKeys, context: context.data }
  const canWriteSales = branchWrite || access.write
  const kitchenWrite = canManageKitchen(posAccess)
  const kitchenRead = access.read || kitchenWrite || hasCapability(posAccess, 'pos.kitchen.operate')
  const kitchenOn = modules?.['fnb.kitchen'] === true
  const cupOn = modules?.['fnb.cup_label'] === true
  const stations = useKitchenStations(branch.id, kitchenOn && kitchenRead)
  const assignments = useBranchReceiptTemplates(branch.id, access.read)
  const missingKds =
    kitchenOn &&
    stations.data != null &&
    !stations.data.some((station) => station.active && station.kds_enabled)
  const hasBranchSheetTemplate = (assignments.data ?? []).some(
    (row) => row.receipt_template?.status === 'active' && isSheetPaper(row.receipt_template.paper),
  )

  const salesKeys: SalesKey[] = [
    'auto_print_prebill',
    'auto_print_receipt',
    'print_void_tickets',
    ...(kitchenOn ? (['auto_print_ready_ticket'] as const) : []),
    'allow_sheet_receipts',
  ]

  return (
    <ModelCard
      title={t('branchPrinting.sectionAuto')}
      id="printing-auto"
      icon={<SlidersHorizontalIcon />}
    >
      <p className="text-sm text-muted-foreground">{t('featuresSections.printIntro')}</p>
      {!canWriteSales && !kitchenWrite ? (
        <p className="text-sm text-muted-foreground">{t('adminReadAccess')}</p>
      ) : null}
      {kitchenOn ? (
        <KitchenTrigger branchId={branch.id} canRead={kitchenRead} canWrite={kitchenWrite} />
      ) : null}
      <SalesFields
        keys={salesKeys}
        extraFor={(key, draft) => {
          if (key === 'auto_print_ready_ticket' && missingKds) {
            return <p role="note">{t('salesAutoPrintReadyNeedsKds')}</p>
          }
          if (
            key === 'allow_sheet_receipts' &&
            !draft.allow_sheet_receipts &&
            hasBranchSheetTemplate
          ) {
            return (
              <p role="note" className="text-amber-600 dark:text-amber-400">
                {t('salesAllowSheetReceiptsBranchWarn')}
              </p>
            )
          }
          return null
        }}
      />
      {cupOn ? (
        <CupAutoPrint branchId={branch.id} canRead={kitchenRead} canWrite={kitchenWrite} />
      ) : null}
    </ModelCard>
  )
}

function KitchenTrigger({
  branchId,
  canRead,
  canWrite,
}: {
  branchId: string
  canRead: boolean
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const settings = useKitchenSettings(branchId, canRead)
  const write = useKitchenWrite()
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  if (!canRead || !settings.data) return null
  return (
    <div className="space-y-2">
      <ModelNotice notice={notice} />
      <ModelSelect
        label={t('branchKitchen.trigger')}
        value={settings.data.kitchen_send_trigger}
        disabled={!canWrite || write.isPending}
        hint={t(`branchKitchen.triggerHint_${settings.data.kitchen_send_trigger}`)}
        options={[
          { value: 'on_complete', label: t('branchKitchen.trigger_on_complete') },
          { value: 'on_save', label: t('branchKitchen.trigger_on_save') },
          { value: 'manual', label: t('branchKitchen.trigger_manual') },
        ]}
        onChange={(value) => {
          setNotice(null)
          void write
            .mutateAsync({
              method: 'PUT',
              path: '/pos/kitchen_settings',
              body: { branch_id: branchId, kitchen_send_trigger: value },
            })
            .then(() => setNotice({ text: t('saved'), failed: false }))
            .catch((error) => setNotice({ text: describeFailure(error, t), failed: true }))
        }}
      />
    </div>
  )
}

function CupAutoPrint({
  branchId,
  canRead,
  canWrite,
}: {
  branchId: string
  canRead: boolean
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const settings = useCupLabelSettings(branchId, canRead)
  const write = useKitchenWrite()
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  if (!canRead || !settings.data) return null
  return (
    <div className="space-y-2">
      <ModelNotice notice={notice} />
      <ToggleRow
        checked={settings.data.auto_print}
        disabled={!canWrite || write.isPending}
        switchLabel={t('salesCupAutoPrint')}
        onChange={(value) => {
          setNotice(null)
          void write
            .mutateAsync({
              method: 'PUT',
              path: '/pos/cup_label_settings',
              body: { branch_id: branchId, auto_print: value },
            })
            .then(() => setNotice({ text: t('saved'), failed: false }))
            .catch((error) => setNotice({ text: describeFailure(error, t), failed: true }))
        }}
        label={t('salesCupAutoPrint')}
        description={t('salesCupAutoPrintHint')}
      />
    </div>
  )
}
