import { formatMoney } from '@parkviet/pos-shared/money'
import { conflictReason, describeFailure } from '@parkviet/pos-shared/request-failure'
import { usePermissions } from '@spree/dashboard-core'
import { Badge, Button, Input, Label, useConfirm } from '@spree/dashboard-ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Palette, QrCode, SlidersHorizontal, UtensilsCrossed } from 'lucide-react'
import { type ChangeEvent, type FormEvent, type ReactNode, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBranchScope } from '../components/branch-detail'
import { type EmenuDish, EmenuPreview, type EmenuPreviewMode } from '../components/emenu-preview'
import { formatAreaTable, StickerPrintPanel } from '../components/emenu-sticker-print'
import { SectionNav } from '../components/section-nav'
import { ModelCard, ModelNotice, ModelSelect } from '../components/setup/model-ui'
import { ToggleRow } from '../components/toggle-row'
import {
  type EmenuCategoryDraft,
  type EmenuSettings,
  type PromotionPhase,
  promotionPhase,
  readEmenuCategory,
  readEmenuMenu,
  uploadEmenuCategoryImage,
  useEmenuMenu,
  useEmenuRefresh,
  useEmenuSettings,
} from '../hooks/use-emenu'
import {
  QR_ORDER_MODES,
  type QrOrderMode,
  type TableSettings,
  useAreas,
  useFloorPlanWrite,
  useTableCodes,
  useTableSettings,
} from '../hooks/use-floor-plan'
import { useBranchMenu, useMenuItems } from '../hooks/use-menu-admin'
import { usePosSession } from '../hooks/use-pos-session'
import { useTimedPromotions } from '../hooks/use-rate-plans'
import { clearBranchLogo, uploadBranchLogo, useBranchInfo } from '../hooks/use-store-info'
import { QR_MAX_ITEMS, readQrLimit, readQrMaxItems } from '../lib/floor-plan'
import { canManageResources, type PosAccess, routeAllowed } from '../lib/pos-access'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'

type Notice = { text: string; failed: boolean } | null
type T = (key: string, options?: Record<string, unknown>) => string

const COLORS = ['#0b6e4f', '#1d4ed8', '#b45309', '#be123c', '#7c3aed', '#1d1d1f']
const SIZES = ['60', '80', '100', 'custom'] as const
const HEX = /^#[0-9a-f]{6}$/i
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg'])
const QR_REFUSALS = ['qr_order_settings_invalid', 'qr_order_limit_required'] as const

function validateImageFile(file: File, t: T): string | null {
  if (!IMAGE_TYPES.has(file.type)) return t('emenu.imageTypeInvalid')
  if (file.size > MAX_IMAGE_BYTES) return t('emenu.imageTooLarge')
  return null
}

function extraFailure(error: unknown, t: T): string {
  const reason = conflictReason(error)
  return reason && (QR_REFUSALS as readonly string[]).includes(reason)
    ? t(`floorPlan.failure_${reason}`)
    : describeFailure(error, t)
}

// The settings each card owns and saves on its own.
const LOOK_KEYS = ['brand_color', 'text_color', 'button_color'] as const
const MENU_SETTING_KEYS = [
  'banner_enabled',
  'banner_promotion_ids',
  'best_sellers_enabled',
  'best_sellers_source',
  'best_seller_item_ids',
  'best_sellers_limit',
  'new_items_enabled',
  'new_item_ids',
] as const
const STICKER_KEYS = [
  'sticker_show_logo',
  'sticker_show_name',
  'sticker_store_name',
  'sticker_wifi_enabled',
  'sticker_wifi_name',
  'sticker_wifi_password',
  'sticker_greeting',
  'sticker_size',
  'sticker_custom_mm',
] as const
const EXTRA_KEYS = [
  'min_order_interval_seconds',
  'paused',
  'payment_timing',
  'pay_methods',
  'prepay_timeout_minutes',
] as const

type SettingKey =
  | (typeof LOOK_KEYS)[number]
  | (typeof MENU_SETTING_KEYS)[number]
  | (typeof STICKER_KEYS)[number]
  | (typeof EXTRA_KEYS)[number]

type SaveOptions = {
  menuIds?: ReadonlySet<string>
  forcePruneMenuRefs?: boolean
}

type Draft = {
  loaded: EmenuSettings
  current: EmenuSettings
  dirty: (keys: readonly SettingKey[]) => boolean
  discard: (keys: readonly SettingKey[]) => void
  patch: (next: Partial<EmenuSettings>) => void
  save: (keys: readonly SettingKey[], options?: SaveOptions) => Promise<void>
}

// Unsaved edits of every card sit here, so the preview shows them as they
// are typed. A card's save sends only its own settings (plus pruned reference
// lists whenever stale IDs would cause a 422 on the server).
function useSettingsDraft(
  branchId: string,
  loaded: EmenuSettings,
  savedMenuIds: ReadonlySet<string>,
  validPromotionIds: ReadonlySet<string> | null,
): Draft {
  const refresh = useEmenuRefresh(branchId)
  const [edits, setEdits] = useState<Partial<EmenuSettings>>({})
  const current = { ...loaded, ...edits }

  return {
    loaded,
    current,
    dirty: (keys) =>
      keys.some((key) => JSON.stringify(current[key]) !== JSON.stringify(loaded[key])),
    discard: (keys) =>
      setEdits((previous) => {
        const next = { ...previous }
        for (const key of keys) delete next[key]
        return next
      }),
    patch: (next) => setEdits((previous) => ({ ...previous, ...next })),
    save: async (keys, options) => {
      const menuAllowlist = options?.menuIds ?? savedMenuIds
      const body: Record<string, unknown> = { branch_id: branchId }
      for (const key of keys) body[key] = current[key]

      // Keep best_sellers_limit a valid integer when saving manual mode.
      if (
        keys.includes('best_sellers_limit') &&
        current.best_sellers_source !== 'auto' &&
        (!Number.isInteger(current.best_sellers_limit) ||
          current.best_sellers_limit < 1 ||
          current.best_sellers_limit > 20)
      ) {
        body.best_sellers_limit = loaded.best_sellers_limit
      }

      // Prune deleted dish/promotion references so the server never 422s.
      const prunedBest = current.best_seller_item_ids.filter((id) => menuAllowlist.has(id))
      if (
        keys.includes('best_seller_item_ids') ||
        options?.forcePruneMenuRefs ||
        loaded.best_seller_item_ids.some((id) => !menuAllowlist.has(id))
      ) {
        body.best_seller_item_ids = prunedBest
      }
      const prunedNew = current.new_item_ids.filter((id) => menuAllowlist.has(id))
      if (
        keys.includes('new_item_ids') ||
        options?.forcePruneMenuRefs ||
        loaded.new_item_ids.some((id) => !menuAllowlist.has(id))
      ) {
        body.new_item_ids = prunedNew
      }
      if (validPromotionIds) {
        const prunedPromos = current.banner_promotion_ids.filter((id) => validPromotionIds.has(id))
        if (
          keys.includes('banner_promotion_ids') ||
          loaded.banner_promotion_ids.some((id) => !validPromotionIds.has(id))
        ) {
          body.banner_promotion_ids = prunedPromos
        }
      }

      await posRequest('PUT', '/pos/emenu_settings', {
        body,
        idempotencyKey: crypto.randomUUID(),
      })
      await refresh()
      setEdits((previous) => {
        const next = { ...previous }
        for (const key of keys) delete next[key]
        if ('best_seller_item_ids' in body) delete next.best_seller_item_ids
        if ('new_item_ids' in body) delete next.new_item_ids
        if ('banner_promotion_ids' in body) delete next.banner_promotion_ids
        return next
      })
    },
  }
}

export function BranchEmenuTab() {
  const { t } = useTranslation()
  const { branch, branchWrite, storeId } = useBranchScope()
  const { permissionKeys } = usePermissions()
  const { context } = usePosSession()
  const posAccess: PosAccess = { permissionKeys, context: context.data }
  const emenuWrite = branchWrite || canManageResources(posAccess)
  const currency = context.data?.store.currency ?? 'VND'
  const settings = useEmenuSettings(branch.id)
  const menu = useEmenuMenu(branch.id)
  if (!settings.data || !menu.data) return <p role="status">{t('waiting')}</p>
  return (
    <Loaded
      key={branch.id}
      branchId={branch.id}
      timeZone={branch.timezone}
      emenuWrite={emenuWrite}
      branchWrite={branchWrite}
      posAccess={posAccess}
      storeId={storeId}
      currency={currency}
      settings={settings.data}
      menu={menu.data}
    />
  )
}

type PromotionItem = {
  id: string
  name: string
  phase: PromotionPhase
}

function Loaded({
  branchId,
  timeZone,
  emenuWrite,
  branchWrite,
  posAccess,
  storeId,
  currency,
  settings,
  menu,
}: {
  branchId: string
  timeZone: string
  emenuWrite: boolean
  branchWrite: boolean
  posAccess: PosAccess
  storeId: string
  currency: string
  settings: EmenuSettings
  menu: EmenuCategoryDraft[]
}) {
  const { t } = useTranslation()
  const [menuDraft, setMenuDraft] = useState<EmenuCategoryDraft[] | null>(null)
  const [previewTab, setPreviewTab] = useState<EmenuPreviewMode>('phone')
  const catalog = useMenuItems(true)
  const counter = useBranchMenu(branchId)
  const promotions = useTimedPromotions(branchId)
  const areas = useAreas(branchId)
  const codes = useTableCodes(branchId, true)

  const savedMenuIds = useMemo(() => new Set(menu.flatMap((category) => category.items)), [menu])
  const promotionRows = useMemo<PromotionItem[]>(
    () =>
      (promotions.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        phase: promotionPhase(row, new Date(), timeZone),
      })),
    [promotions.data, timeZone],
  )
  const validPromotionIds = useMemo(
    () => (promotions.isSuccess ? new Set(promotionRows.map((row) => row.id)) : null),
    [promotions.isSuccess, promotionRows],
  )
  const runningPromotionNames = useMemo(
    () =>
      new Map(
        promotionRows.filter((row) => row.phase === 'running').map((row) => [row.id, row.name]),
      ),
    [promotionRows],
  )

  const draft = useSettingsDraft(branchId, settings, savedMenuIds, validPromotionIds)

  const dishes = useMemo(() => {
    const counterItems = counter.data?.items
    const hasCounterList = Array.isArray(counterItems)
    const pictures = new Map((counterItems ?? []).map((item) => [item.id, item]))
    const out = new Map<string, EmenuDish>()
    for (const item of catalog.data ?? []) {
      const shown = pictures.get(item.id)
      const prices = (shown?.variants ?? item.variants)
        .map((variant) => variant.price)
        .filter((price): price is string => price !== null)
        .sort((a, b) => Number(a) - Number(b))
      out.set(item.id, {
        id: item.id,
        name: item.name,
        price: prices[0] ?? null,
        image_url: shown?.image_url ?? null,
        atCounter: hasCounterList ? pictures.has(item.id) : true,
      })
    }
    return out
  }, [catalog.data, counter.data])

  const sampleTable = useMemo(() => {
    const first = codes.data?.[0]
    if (!first) return undefined
    const areaMap = new Map((areas.data ?? []).map((area) => [area.id, area.name]))
    return formatAreaTable(areaMap.get(first.area_id), first.name)
  }, [areas.data, codes.data])

  const sections = useMemo(
    () => [
      { id: 'emenu-look', label: t('emenu.section_look') },
      { id: 'emenu-menu', label: t('emenu.section_menu') },
      { id: 'emenu-sticker', label: t('emenu.section_sticker') },
      { id: 'emenu-extra', label: t('emenu.section_extra') },
    ],
    [t],
  )

  const currentMenu = menuDraft ?? menu
  const syncSection = (sectionId: string) =>
    setPreviewTab(sectionId === 'emenu-sticker' ? 'sticker' : 'phone')
  const focus = (next: EmenuPreviewMode) => () => setPreviewTab(next)

  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        <SectionNav
          orientation="horizontal"
          sections={sections}
          label={t('branchTabs.emenu')}
          onSelect={syncSection}
          onScrollActive={syncSection}
        />
        <div onFocusCapture={focus('phone')}>
          <LookCard
            branchId={branchId}
            storeId={storeId}
            emenuWrite={emenuWrite}
            branchWrite={branchWrite}
            draft={draft}
          />
        </div>
        <div onFocusCapture={focus('phone')}>
          <MenuCard
            branchId={branchId}
            storeId={storeId}
            write={emenuWrite}
            posAccess={posAccess}
            loaded={menu}
            menuDraft={menuDraft}
            onMenuDraft={setMenuDraft}
            settingsDraft={draft}
            dishes={dishes}
            promotions={promotionRows}
            currency={currency}
          />
        </div>
        <div onFocusCapture={focus('sticker')}>
          <StickerCard branchId={branchId} storeId={storeId} write={emenuWrite} draft={draft} />
        </div>
        <div onFocusCapture={focus('phone')}>
          <ExtraCard
            branchId={branchId}
            emenuWrite={emenuWrite}
            branchWrite={branchWrite}
            draft={draft}
          />
        </div>
      </div>
      <div className="sticky top-[var(--spacing-header-height,4rem)] hidden max-h-[calc(100dvh-var(--spacing-header-height,4rem))] w-[340px] shrink-0 space-y-4 self-start overflow-y-auto pb-4 lg:block">
        <EmenuPreview
          mode={previewTab}
          onMode={setPreviewTab}
          settings={draft.current}
          menu={currentMenu}
          dishes={dishes}
          promotions={runningPromotionNames}
          currency={currency}
          sampleTable={sampleTable}
        />
      </div>
    </div>
  )
}

function SaveRow({
  notice,
  busy,
  dirty,
  canSave,
  onDiscard,
  children,
}: {
  notice: Notice
  busy: boolean
  dirty: boolean
  canSave: boolean
  onDiscard: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 border-t pt-4">
      {notice ? <ModelNotice notice={notice} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={busy || !dirty} onClick={onDiscard}>
          {t('emenu.discard')}
        </Button>
        <Button type="submit" disabled={busy || !canSave}>
          {busy ? t('waiting') : t('emenu.save')}
        </Button>
        {children}
      </div>
    </div>
  )
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h4 className="pt-2 text-sm font-semibold">{children}</h4>
}

function LookCard({
  branchId,
  storeId,
  emenuWrite,
  branchWrite,
  draft,
}: {
  branchId: string
  storeId: string
  emenuWrite: boolean
  branchWrite: boolean
  draft: Draft
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const branchInfo = useBranchInfo(branchId, branchWrite)
  const [notice, setNotice] = useState<Notice>(null)
  const [logoNotice, setLogoNotice] = useState<Notice>(null)
  const { current, patch } = draft

  const hasBranchLogo = useMemo(() => {
    const data = branchInfo.data
    if (typeof data === 'object' && data !== null && !Array.isArray(data) && 'overrides' in data) {
      return Boolean((data as { logo_url?: unknown }).logo_url)
    }
    return Boolean(current.logo_url)
  }, [branchInfo.data, current.logo_url])

  const invalidateLogo = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: posKey(storeId, 'emenu-settings', branchId) }),
      queryClient.invalidateQueries({ queryKey: posKey(storeId, 'branch-info', branchId) }),
    ])
  }

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => uploadBranchLogo(branchId, file),
  })
  const removeLogoMutation = useMutation({
    mutationFn: () => clearBranchLogo(branchId),
  })
  const saveMutation = useMutation({
    mutationFn: () => draft.save(LOOK_KEYS),
  })

  const logoBusy = uploadLogoMutation.isPending || removeLogoMutation.isPending
  const busy = saveMutation.isPending
  const colorsValid = [current.brand_color, current.text_color, current.button_color].every(
    (color) => HEX.test(color),
  )
  const dirty = draft.dirty(LOOK_KEYS)
  const canSave = emenuWrite && dirty && colorsValid

  const handleLogoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || logoBusy || !branchWrite) return
    const problem = validateImageFile(file, t)
    if (problem) {
      setLogoNotice({ text: problem, failed: true })
      return
    }
    setLogoNotice(null)
    try {
      await uploadLogoMutation.mutateAsync(file)
      await invalidateLogo()
      setLogoNotice({ text: t('emenu.logoSaved'), failed: false })
    } catch (failure) {
      setLogoNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const handleRemoveLogo = async () => {
    if (logoBusy || !branchWrite) return
    setLogoNotice(null)
    try {
      await removeLogoMutation.mutateAsync()
      await invalidateLogo()
      setLogoNotice({ text: t('emenu.logoRemoved'), failed: false })
    } catch (failure) {
      setLogoNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canSave) return
    setNotice(null)
    try {
      await saveMutation.mutateAsync()
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  return (
    <ModelCard
      title={t('emenu.section_look')}
      id="emenu-look"
      icon={<Palette className="size-4" aria-hidden />}
    >
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-3">
            {current.logo_url ? (
              <img
                src={current.logo_url}
                alt=""
                className="h-12 w-12 rounded-full border object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full border text-xs text-muted-foreground">
                {t('emenu.noLogo')}
              </span>
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{current.store_name || t('emenu.previewStore')}</p>
              <p className="text-muted-foreground">{t('emenu.logoHint')}</p>
            </div>
            {branchWrite ? (
              <div className="flex flex-wrap items-center gap-2">
                <Label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-label={t(current.logo_url ? 'emenu.editLogo' : 'emenu.uploadLogo')}
                    disabled={logoBusy}
                    className="sr-only"
                    onChange={(event) => void handleLogoFile(event)}
                  />
                  <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">
                    {logoBusy
                      ? t('waiting')
                      : t(current.logo_url ? 'emenu.editLogo' : 'emenu.uploadLogo')}
                  </span>
                </Label>
                {hasBranchLogo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={logoBusy}
                    onClick={() => void handleRemoveLogo()}
                  >
                    {t('emenu.removeLogo')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <ModelNotice notice={logoNotice} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(['brand_color', 'text_color', 'button_color'] as const).map((key) => (
            <ColorField
              key={key}
              label={t(`emenu.${key}`)}
              value={current[key]}
              disabled={!emenuWrite || busy}
              onChange={(value) => patch({ [key]: value })}
            />
          ))}
        </div>
        {!colorsValid ? (
          <p className="text-sm text-destructive">{t('emenu.colorInvalid')}</p>
        ) : null}
        <SaveRow
          notice={notice}
          busy={busy}
          dirty={dirty}
          canSave={canSave}
          onDiscard={() => {
            setNotice(null)
            draft.discard(LOOK_KEYS)
          }}
        />
      </form>
    </ModelCard>
  )
}

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const valid = HEX.test(value)
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={valid ? value : '#000000'}
          disabled={disabled}
          className="h-9 w-11 cursor-pointer rounded border bg-transparent p-0.5"
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          type="text"
          value={value}
          disabled={disabled}
          aria-invalid={!valid}
          className="w-28 font-mono"
          onChange={(event) => onChange(event.target.value.trim())}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={value.toLowerCase() === color}
            disabled={disabled}
            className={`h-6 w-6 rounded-full border ${
              value.toLowerCase() === color ? 'ring-2 ring-ring ring-offset-2' : ''
            }`}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  hint,
  invalid,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled: boolean
  hint?: ReactNode
  invalid?: boolean
  onChange: (value: number) => void
}) {
  const outside = !Number.isInteger(value) || value < min || value > max
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isNaN(value) ? '' : String(value)}
        disabled={disabled}
        aria-label={label}
        aria-invalid={outside || invalid}
        onChange={(event) =>
          onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))
        }
      />
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

const normalizeMenuTree = (rows: EmenuCategoryDraft[]) =>
  rows.map((row) => ({
    id: row.id ?? null,
    name: row.name,
    color: row.color || '',
    items: row.items,
  }))

type PromoFilter = 'all' | PromotionPhase

function MenuCard({
  branchId,
  storeId,
  write,
  posAccess,
  loaded,
  menuDraft,
  onMenuDraft,
  settingsDraft,
  dishes,
  promotions,
  currency,
}: {
  branchId: string
  storeId: string
  write: boolean
  posAccess: PosAccess
  loaded: EmenuCategoryDraft[]
  menuDraft: EmenuCategoryDraft[] | null
  onMenuDraft: (next: EmenuCategoryDraft[] | null) => void
  settingsDraft: Draft
  dishes: Map<string, EmenuDish>
  promotions: PromotionItem[]
  currency: string
}) {
  const { t } = useTranslation()
  const refresh = useEmenuRefresh(branchId)
  const confirm = useConfirm()
  const [notice, setNotice] = useState<Notice>(null)
  const [promoFilter, setPromoFilter] = useState<PromoFilter>('all')

  const currentMenu = menuDraft ?? loaded
  const { current: settings, patch } = settingsDraft
  const used = useMemo(
    () => new Set(currentMenu.flatMap((category) => category.items)),
    [currentMenu],
  )
  const menuDishes = useMemo(
    () =>
      [...used].flatMap((id) => {
        const dish = dishes.get(id)
        return dish ? [dish] : []
      }),
    [used, dishes],
  )

  const namesValid = currentMenu.every((category) => category.name.trim().length > 0)
  const categoryColorsValid = currentMenu.every(
    (category) => !category.color || HEX.test(category.color),
  )
  const bestSellersLimitValid =
    !settings.best_sellers_enabled ||
    settings.best_sellers_source !== 'auto' ||
    (Number.isInteger(settings.best_sellers_limit) &&
      settings.best_sellers_limit >= 1 &&
      settings.best_sellers_limit <= 20)

  const menuTreeDirty =
    menuDraft !== null &&
    JSON.stringify(normalizeMenuTree(menuDraft)) !== JSON.stringify(normalizeMenuTree(loaded))
  const settingsDirty = settingsDraft.dirty(MENU_SETTING_KEYS)
  const dirty = menuTreeDirty || settingsDirty

  const saveTree = async (rows: EmenuCategoryDraft[]) => {
    const response = await posRequest<{ data?: unknown }>('PUT', '/pos/emenu_menu', {
      body: {
        branch_id: branchId,
        categories: rows.map((category) => ({
          id: category.id,
          name: category.name.trim(),
          color: category.color || null,
          items: category.items,
        })),
      },
      idempotencyKey: crypto.randomUUID(),
    })
    return readEmenuMenu(response.data)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (menuTreeDirty) {
        await saveTree(currentMenu)
      }
      const needsRefPrune =
        settingsDraft.loaded.best_seller_item_ids.some((id) => !used.has(id)) ||
        settingsDraft.loaded.new_item_ids.some((id) => !used.has(id))
      if (settingsDirty || needsRefPrune) {
        await settingsDraft.save(MENU_SETTING_KEYS, {
          menuIds: used,
          forcePruneMenuRefs: needsRefPrune,
        })
      } else {
        await refresh()
      }
      onMenuDraft(null)
    },
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await posRequest<{ data?: unknown }>('POST', '/pos/emenu_menu/import', {
        body: { branch_id: branchId },
        idempotencyKey: crypto.randomUUID(),
      })
      const imported = readEmenuMenu(response.data)
      const importedIds = new Set(imported.flatMap((category) => category.items))
      const needsPrune =
        settingsDraft.current.best_seller_item_ids.some((id) => !importedIds.has(id)) ||
        settingsDraft.current.new_item_ids.some((id) => !importedIds.has(id))
      if (needsPrune) {
        await settingsDraft.save(MENU_SETTING_KEYS, {
          menuIds: importedIds,
          forcePruneMenuRefs: true,
        })
      } else {
        await refresh()
      }
      onMenuDraft(null)
    },
  })

  const imageMutation = useMutation({
    mutationFn: async ({ index, file }: { index: number; file: File }) => {
      let rows = currentMenu
      let categoryId = rows[index]?.id
      if (!categoryId) {
        const saved = await saveTree(rows)
        rows = saved
        categoryId = saved[index]?.id
      }
      if (!categoryId) throw new Error('Category was not saved')
      const response = await uploadEmenuCategoryImage(branchId, categoryId, file)
      const updated = readEmenuCategory(response.data)
      await refresh()
      if (menuDraft !== null || !rows[index]?.id) {
        onMenuDraft(
          rows.map((row, pos) =>
            pos === index
              ? { ...row, id: categoryId, image_url: updated?.image_url ?? row.image_url }
              : row,
          ),
        )
      }
    },
  })

  const busy = saveMutation.isPending || importMutation.isPending || imageMutation.isPending
  const canSave = write && dirty && namesValid && categoryColorsValid && bestSellersLimitValid

  const updateCategory = (index: number, next: Partial<EmenuCategoryDraft>) =>
    onMenuDraft(
      currentMenu.map((row, position) => (position === index ? { ...row, ...next } : row)),
    )

  const move = <Item,>(list: Item[], from: number, to: number) => {
    if (to < 0 || to >= list.length) return list
    const next = [...list]
    const [row] = next.splice(from, 1)
    next.splice(to, 0, row)
    return next
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canSave) return
    setNotice(null)
    try {
      await saveMutation.mutateAsync()
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const importCounter = async () => {
    if (busy || !write) return
    if (
      currentMenu.length > 0 &&
      !(await confirm({
        message: t('emenu.copyCounterConfirm'),
        variant: 'destructive',
        confirmLabel: t('emenu.copyCounter'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setNotice(null)
    try {
      await importMutation.mutateAsync()
      setNotice({ text: t('emenu.copied'), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const handleCategoryImage = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy || !write) return
    const problem = validateImageFile(file, t)
    if (problem) {
      setNotice({ text: problem, failed: true })
      return
    }
    if (!currentMenu[index]?.id && !namesValid) {
      setNotice({ text: t('emenu.nameRequired'), failed: true })
      return
    }
    setNotice(null)
    try {
      await imageMutation.mutateAsync({ index, file })
      setNotice({ text: t('emenu.imageSaved'), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const removeCategory = async (index: number) => {
    const category = currentMenu[index]
    if (
      category.items.length > 0 &&
      !(await confirm({
        message: t('emenu.removeCategoryConfirm', { name: category.name }),
        variant: 'destructive',
        confirmLabel: t('emenu.remove'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    onMenuDraft(currentMenu.filter((_, position) => position !== index))
  }

  const filteredPromotions = useMemo(
    () =>
      promoFilter === 'all'
        ? promotions
        : promotions.filter((promo) => promo.phase === promoFilter),
    [promoFilter, promotions],
  )

  return (
    <ModelCard
      title={t('emenu.section_menu')}
      id="emenu-menu"
      icon={<UtensilsCrossed className="size-4" aria-hidden />}
    >
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t('emenu.menuSummary', { categories: currentMenu.length, items: used.size })}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!write || busy}
            onClick={() => void importCounter()}
          >
            {t('emenu.copyCounter')}
          </Button>
        </div>

        {currentMenu.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('emenu.menuEmpty')}
          </p>
        ) : null}

        {currentMenu.map((category, index) => (
          <fieldset
            key={category.id ?? `new-${index}`}
            className="space-y-3 rounded-lg border p-3"
            aria-label={category.name || t('emenu.categoryName')}
          >
            <div className="flex flex-wrap items-center gap-2">
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-md border object-cover"
                />
              ) : null}
              <Input
                value={category.name}
                maxLength={80}
                disabled={!write || busy}
                aria-label={t('emenu.categoryName')}
                aria-invalid={category.name.trim().length === 0}
                className="min-w-40 flex-1 font-medium"
                onChange={(event) => updateCategory(index, { name: event.target.value })}
              />
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  aria-label={t('emenu.categoryColor')}
                  value={HEX.test(category.color) ? category.color : '#0b6e4f'}
                  disabled={!write || busy}
                  className="h-8 w-9 cursor-pointer rounded border bg-transparent p-0.5"
                  onChange={(event) => updateCategory(index, { color: event.target.value })}
                />
                {category.color ? (
                  <IconButton
                    label={t('emenu.clearCategoryColor')}
                    disabled={!write || busy}
                    onClick={() => updateCategory(index, { color: '' })}
                  >
                    ×
                  </IconButton>
                ) : null}
              </div>
              {write ? (
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-label={t('emenu.categoryImage')}
                    disabled={busy}
                    className="sr-only"
                    onChange={(event) => void handleCategoryImage(index, event)}
                  />
                  <span className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                    {t(
                      category.image_url
                        ? 'emenu.changeCategoryImage'
                        : 'emenu.uploadCategoryImage',
                    )}
                  </span>
                </label>
              ) : null}
              <IconButton
                label={t('emenu.moveUp')}
                disabled={!write || busy || index === 0}
                onClick={() => onMenuDraft(move(currentMenu, index, index - 1))}
              >
                ↑
              </IconButton>
              <IconButton
                label={t('emenu.moveDown')}
                disabled={!write || busy || index === currentMenu.length - 1}
                onClick={() => onMenuDraft(move(currentMenu, index, index + 1))}
              >
                ↓
              </IconButton>
              <IconButton
                label={t('emenu.removeCategory')}
                disabled={!write || busy}
                onClick={() => void removeCategory(index)}
              >
                ×
              </IconButton>
            </div>

            {category.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('emenu.categoryEmpty')}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {category.items.map((id, position) => {
                  const dish = dishes.get(id)
                  return (
                    <li key={id} className="flex items-center gap-3 px-3 py-2">
                      {dish?.image_url ? (
                        <img src={dish.image_url} alt="" className="h-9 w-9 rounded object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                          {(dish?.name ?? '?').slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{dish?.name ?? id}</span>
                      {dish?.atCounter === false ? (
                        <Badge variant="outline" className="shrink-0">
                          {t('emenu.notAtCounter')}
                        </Badge>
                      ) : null}
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {dish?.price ? formatMoney(dish.price, currency) : ''}
                      </span>
                      <IconButton
                        label={t('emenu.moveUp')}
                        disabled={!write || busy || position === 0}
                        onClick={() =>
                          updateCategory(index, {
                            items: move(category.items, position, position - 1),
                          })
                        }
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label={t('emenu.moveDown')}
                        disabled={!write || busy || position === category.items.length - 1}
                        onClick={() =>
                          updateCategory(index, {
                            items: move(category.items, position, position + 1),
                          })
                        }
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        label={t('emenu.removeItem', { name: dish?.name ?? id })}
                        disabled={!write || busy}
                        onClick={() =>
                          updateCategory(index, {
                            items: category.items.filter((row) => row !== id),
                          })
                        }
                      >
                        ×
                      </IconButton>
                    </li>
                  )
                })}
              </ul>
            )}

            {write ? (
              <DishPicker
                dishes={dishes}
                used={used}
                currency={currency}
                disabled={busy}
                onPick={(id) => updateCategory(index, { items: [...category.items, id] })}
              />
            ) : null}
          </fieldset>
        ))}

        <Button
          type="button"
          variant="outline"
          disabled={!write || busy}
          onClick={() =>
            onMenuDraft([
              ...currentMenu,
              { name: t('emenu.newCategory'), color: '', image_url: null, items: [] },
            ])
          }
        >
          {t('emenu.addCategory')}
        </Button>

        <SubHeading>{t('emenu.homeSections')}</SubHeading>

        <ToggleRow
          checked={settings.banner_enabled}
          disabled={!write || busy}
          label={t('emenu.banner')}
          description={t('emenu.bannerHint')}
          switchLabel={t('emenu.banner')}
          onChange={(value) => patch({ banner_enabled: value })}
        >
          {settings.banner_enabled ? (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', 'emenu.promoFilterAll'],
                      ['running', 'emenu.promoFilterRunning'],
                      ['upcoming', 'emenu.promoFilterUpcoming'],
                      ['ended', 'emenu.promoFilterEnded'],
                    ] as const
                  ).map(([key, labelKey]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={promoFilter === key}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        promoFilter === key
                          ? 'border-foreground bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                      onClick={() => setPromoFilter(key)}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
                {routeAllowed('branch-rate-plans', posAccess) ? (
                  <Link
                    to={`/${storeId}/branches/${branchId}/rate-plans` as string}
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {t('emenu.managePromotions')}
                  </Link>
                ) : null}
              </div>
              {promotions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('emenu.noPromotions')}</p>
              ) : filteredPromotions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('emenu.noPromotionsInFilter')}</p>
              ) : (
                <ChoiceList
                  disabled={!write || busy}
                  options={filteredPromotions.map((row) => ({ id: row.id, name: row.name }))}
                  selected={settings.banner_promotion_ids}
                  onChange={(ids) => patch({ banner_promotion_ids: ids })}
                />
              )}
            </div>
          ) : null}
        </ToggleRow>

        <ToggleRow
          checked={settings.best_sellers_enabled}
          disabled={!write || busy}
          label={t('emenu.bestSellers')}
          switchLabel={t('emenu.bestSellers')}
          onChange={(value) => patch({ best_sellers_enabled: value })}
        >
          {settings.best_sellers_enabled ? (
            <div className="space-y-3 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <ModelSelect
                  label={t('emenu.bestSellersSource')}
                  value={settings.best_sellers_source}
                  disabled={!write || busy}
                  options={[
                    { value: 'manual', label: t('emenu.sourceManual') },
                    { value: 'auto', label: t('emenu.sourceAuto') },
                  ]}
                  onChange={(value) =>
                    patch({ best_sellers_source: value === 'auto' ? 'auto' : 'manual' })
                  }
                />
                {settings.best_sellers_source === 'auto' ? (
                  <NumberField
                    label={t('emenu.bestSellersLimit')}
                    value={settings.best_sellers_limit}
                    min={1}
                    max={20}
                    disabled={!write || busy}
                    invalid={!bestSellersLimitValid}
                    hint={
                      !bestSellersLimitValid ? (
                        <span className="text-destructive">
                          {t('emenu.bestSellersLimitInvalid')}
                        </span>
                      ) : undefined
                    }
                    onChange={(value) => patch({ best_sellers_limit: value })}
                  />
                ) : null}
              </div>
              {settings.best_sellers_source === 'auto' ? (
                <p className="text-sm text-muted-foreground">{t('emenu.sourceAutoHint')}</p>
              ) : (
                <DishListEditor
                  disabled={!write || busy}
                  dishes={menuDishes}
                  selected={settings.best_seller_item_ids.filter((id) => used.has(id))}
                  onChange={(ids) => patch({ best_seller_item_ids: ids })}
                />
              )}
            </div>
          ) : null}
        </ToggleRow>

        <ToggleRow
          checked={settings.new_items_enabled}
          disabled={!write || busy}
          label={t('emenu.newItems')}
          switchLabel={t('emenu.newItems')}
          onChange={(value) => patch({ new_items_enabled: value })}
        >
          {settings.new_items_enabled ? (
            <div className="pt-2">
              <DishListEditor
                disabled={!write || busy}
                dishes={menuDishes}
                selected={settings.new_item_ids.filter((id) => used.has(id))}
                onChange={(ids) => patch({ new_item_ids: ids })}
              />
            </div>
          ) : null}
        </ToggleRow>

        {!namesValid ? <p className="text-sm text-destructive">{t('emenu.nameRequired')}</p> : null}
        {!categoryColorsValid ? (
          <p className="text-sm text-destructive">{t('emenu.colorInvalid')}</p>
        ) : null}
        <SaveRow
          notice={notice}
          busy={busy}
          dirty={dirty}
          canSave={canSave}
          onDiscard={() => {
            setNotice(null)
            onMenuDraft(null)
            settingsDraft.discard(MENU_SETTING_KEYS)
          }}
        />
      </form>
    </ModelCard>
  )
}

function DishListEditor({
  dishes,
  selected,
  disabled,
  onChange,
}: {
  dishes: EmenuDish[]
  selected: string[]
  disabled: boolean
  onChange: (ids: string[]) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  if (dishes.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('emenu.menuFirst')}</p>
  }
  const byId = new Map(dishes.map((dish) => [dish.id, dish]))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((id) => {
          const dish = byId.get(id)
          if (!dish) return null
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-sm"
            >
              {dish.name}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={t('emenu.removeItem', { name: dish.name })}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onChange(selected.filter((row) => row !== id))}
                >
                  ×
                </button>
              ) : null}
            </span>
          )
        })}
        {!disabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((open) => !open)}
          >
            {t(editing ? 'emenu.doneEditingList' : 'emenu.editList')}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <ChoiceList
          disabled={disabled}
          options={dishes.map((dish) => ({ id: dish.id, name: dish.name }))}
          selected={selected}
          onChange={onChange}
        />
      ) : null}
    </div>
  )
}

// Pills that toggle; the order picked is the order shown. At most twenty.
function ChoiceList({
  options,
  selected,
  disabled,
  onChange,
}: {
  options: { id: string; name: string }[]
  selected: string[]
  disabled: boolean
  onChange: (ids: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {options.map((option) => {
        const on = selected.includes(option.id)
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            disabled={disabled || (!on && selected.length >= 20)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            onClick={() =>
              onChange(on ? selected.filter((id) => id !== option.id) : [...selected, option.id])
            }
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm hover:bg-muted disabled:opacity-40"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// Search the store's dishes and add one; a dish sits in one category only.
function DishPicker({
  dishes,
  used,
  currency,
  disabled,
  onPick,
}: {
  dishes: Map<string, EmenuDish>
  used: Set<string>
  currency: string
  disabled?: boolean
  onPick: (id: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase(i18n.language)
  const matches = needle
    ? [...dishes.values()]
        .filter((dish) => !used.has(dish.id))
        .filter((dish) => dish.name.toLocaleLowerCase(i18n.language).includes(needle))
        .slice(0, 8)
    : []
  return (
    <div className="space-y-1">
      <Input
        type="search"
        value={query}
        disabled={disabled}
        placeholder={t('emenu.addItem')}
        aria-label={t('emenu.addItem')}
        onChange={(event) => setQuery(event.target.value)}
      />
      {needle ? (
        matches.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">{t('emenu.noMatch')}</p>
        ) : (
          <ul className="max-h-60 overflow-y-auto rounded-md border">
            {matches.map((dish) => (
              <li key={dish.id}>
                <button
                  type="button"
                  disabled={disabled}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onPick(dish.id)
                    setQuery('')
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{dish.name}</span>
                  {dish.atCounter === false ? (
                    <Badge variant="outline" className="shrink-0">
                      {t('emenu.notAtCounter')}
                    </Badge>
                  ) : null}
                  <span className="tabular-nums text-muted-foreground">
                    {dish.price ? formatMoney(dish.price, currency) : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}

function StickerCard({
  branchId,
  storeId,
  write,
  draft,
}: {
  branchId: string
  storeId: string
  write: boolean
  draft: Draft
}) {
  const { t } = useTranslation()
  const [notice, setNotice] = useState<Notice>(null)
  const { current, patch } = draft
  const saveMutation = useMutation({
    mutationFn: () => draft.save(STICKER_KEYS),
  })
  const busy = saveMutation.isPending
  const customValid =
    current.sticker_size !== 'custom' ||
    (Number.isInteger(current.sticker_custom_mm) &&
      current.sticker_custom_mm >= 40 &&
      current.sticker_custom_mm <= 200)
  const dirty = draft.dirty(STICKER_KEYS)
  const canSave = write && dirty && customValid

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canSave) return
    setNotice(null)
    try {
      await saveMutation.mutateAsync()
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  return (
    <ModelCard
      title={t('emenu.section_sticker')}
      id="emenu-sticker"
      icon={<QrCode className="size-4" aria-hidden />}
    >
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        <p className="text-sm text-muted-foreground">{t('emenu.stickerHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ModelSelect
            label={t('emenu.stickerSize')}
            value={current.sticker_size}
            disabled={!write || busy}
            options={SIZES.map((size) => ({
              value: size,
              label: size === 'custom' ? t('emenu.sizeCustom') : `${size} mm`,
            }))}
            onChange={(value) => patch({ sticker_size: value as EmenuSettings['sticker_size'] })}
          />
          {current.sticker_size === 'custom' ? (
            <NumberField
              label={t('emenu.customWidth')}
              value={current.sticker_custom_mm}
              min={40}
              max={200}
              disabled={!write || busy}
              hint={t('emenu.customWidthHint')}
              onChange={(value) => patch({ sticker_custom_mm: value })}
            />
          ) : null}
        </div>
        <ToggleRow
          checked={current.sticker_show_logo}
          disabled={!write || busy}
          label={t('emenu.showLogo')}
          description={current.logo_url ? undefined : t('emenu.noLogoHint')}
          switchLabel={t('emenu.showLogo')}
          onChange={(value) => patch({ sticker_show_logo: value })}
        />
        <ToggleRow
          checked={current.sticker_show_name}
          disabled={!write || busy}
          label={t('emenu.showName')}
          switchLabel={t('emenu.showName')}
          onChange={(value) => patch({ sticker_show_name: value })}
        >
          {current.sticker_show_name ? (
            <div className="space-y-2 pt-2">
              <Label htmlFor="emenu-sticker-name">{t('emenu.storeName')}</Label>
              <Input
                id="emenu-sticker-name"
                value={current.sticker_store_name}
                maxLength={80}
                disabled={!write || busy}
                placeholder={current.store_name}
                onChange={(event) => patch({ sticker_store_name: event.target.value })}
              />
            </div>
          ) : null}
        </ToggleRow>
        <div className="space-y-2">
          <Label htmlFor="emenu-greeting">
            {t('emenu.greeting', { count: current.sticker_greeting.length })}
          </Label>
          <Input
            id="emenu-greeting"
            maxLength={100}
            value={current.sticker_greeting}
            disabled={!write || busy}
            onChange={(event) => patch({ sticker_greeting: event.target.value })}
          />
        </div>
        <ToggleRow
          checked={current.sticker_wifi_enabled}
          disabled={!write || busy}
          label={t('emenu.wifi')}
          switchLabel={t('emenu.wifi')}
          onChange={(value) => patch({ sticker_wifi_enabled: value })}
        >
          {current.sticker_wifi_enabled ? (
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emenu-wifi-name">{t('emenu.wifiName')}</Label>
                <Input
                  id="emenu-wifi-name"
                  value={current.sticker_wifi_name}
                  maxLength={64}
                  disabled={!write || busy}
                  onChange={(event) => patch({ sticker_wifi_name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emenu-wifi-password">{t('emenu.wifiPassword')}</Label>
                <Input
                  id="emenu-wifi-password"
                  value={current.sticker_wifi_password}
                  maxLength={64}
                  disabled={!write || busy}
                  onChange={(event) => patch({ sticker_wifi_password: event.target.value })}
                />
              </div>
            </div>
          ) : null}
        </ToggleRow>
        <SaveRow
          notice={notice}
          busy={busy}
          dirty={dirty}
          canSave={canSave}
          onDiscard={() => {
            setNotice(null)
            draft.discard(STICKER_KEYS)
          }}
        >
          <Link
            to={`/${storeId}/branches/${branchId}/floor-plan` as string}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('emenu.printCodes')}
          </Link>
        </SaveRow>
      </form>
      <StickerPrintPanel branchId={branchId} write={write} settings={current} />
    </ModelCard>
  )
}

type QrDraft = {
  mode: QrOrderMode
  limit: string
  maxItems: string
}

const qrDraftOf = (settings: TableSettings): QrDraft => ({
  mode: settings.qr_order_mode,
  limit: settings.qr_order_auto_limit?.replace(/\.0+$/, '') ?? '',
  maxItems: String(settings.qr_order_auto_max_items),
})

function ExtraCard({
  branchId,
  emenuWrite,
  branchWrite,
  draft,
}: {
  branchId: string
  emenuWrite: boolean
  branchWrite: boolean
  draft: Draft
}) {
  const { t } = useTranslation()
  const table = useTableSettings(branchId)
  const tableWrite = useFloorPlanWrite()
  const [notice, setNotice] = useState<Notice>(null)
  const [qrEdits, setQrEdits] = useState<Partial<QrDraft>>({})
  const limitId = useId()
  const countId = useId()

  const { current, patch } = draft
  const qrLoaded = table.data ? qrDraftOf(table.data) : null
  const qrCurrent = qrLoaded ? { ...qrLoaded, ...qrEdits } : null

  const qrLimit = qrCurrent ? readQrLimit(qrCurrent.limit) : null
  const qrMaxItems = qrCurrent ? readQrMaxItems(qrCurrent.maxItems) : 10
  const directMode = qrCurrent?.mode === 'direct_to_kitchen'
  const qrLimitInvalid = directMode && (qrLimit === undefined || qrLimit === null)
  const qrMaxItemsInvalid = directMode && qrMaxItems === undefined
  const qrValid = !directMode || (!qrLimitInvalid && !qrMaxItemsInvalid)

  const qrDirty = Boolean(
    branchWrite && qrLoaded && qrCurrent && JSON.stringify(qrCurrent) !== JSON.stringify(qrLoaded),
  )
  const emenuDirty = emenuWrite && draft.dirty(EXTRA_KEYS)
  const dirty = emenuDirty || qrDirty

  const prepay = current.payment_timing === 'pay_before'
  const tooLong = current.prepay_timeout_minutes > current.vietqr_timeout_minutes
  const intervalValid =
    Number.isInteger(current.min_order_interval_seconds) &&
    current.min_order_interval_seconds >= 0 &&
    current.min_order_interval_seconds <= 3600
  const timeoutValid =
    Number.isInteger(current.prepay_timeout_minutes) &&
    current.prepay_timeout_minutes >= 1 &&
    current.prepay_timeout_minutes <= 60
  const emenuValid = current.pay_methods.length > 0 && intervalValid && timeoutValid

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (emenuDirty) {
        await draft.save(EXTRA_KEYS)
      }
      if (qrDirty && qrCurrent) {
        await tableWrite.mutateAsync({
          method: 'PUT',
          path: '/pos/table_settings',
          body: {
            branch_id: branchId,
            qr_order_mode: qrCurrent.mode,
            ...(qrCurrent.mode === 'direct_to_kitchen'
              ? {
                  qr_order_auto_limit: qrLimit,
                  qr_order_auto_max_items: qrMaxItems,
                }
              : {}),
          },
        })
        setQrEdits({})
      }
    },
  })

  const busy = saveMutation.isPending || tableWrite.isPending
  const canSave = dirty && emenuValid && qrValid

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canSave) return
    setNotice(null)
    try {
      await saveMutation.mutateAsync()
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      setNotice({ text: extraFailure(failure, t), failed: true })
    }
  }

  const toggleMethod = (method: 'vietqr' | 'counter', on: boolean) =>
    patch({
      pay_methods: on
        ? [...new Set([...current.pay_methods, method])]
        : current.pay_methods.filter((row) => row !== method),
    })

  return (
    <ModelCard
      title={t('emenu.section_extra')}
      id="emenu-extra"
      icon={<SlidersHorizontal className="size-4" aria-hidden />}
    >
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        <ToggleRow
          checked={current.paused}
          disabled={!emenuWrite || busy}
          label={t('emenu.paused')}
          description={t('emenu.pausedHint')}
          switchLabel={t('emenu.paused')}
          onChange={(value) => patch({ paused: value })}
        />
        <NumberField
          label={t('emenu.interval')}
          value={current.min_order_interval_seconds}
          min={0}
          max={3600}
          disabled={!emenuWrite || busy}
          hint={t('emenu.intervalHint')}
          onChange={(value) => patch({ min_order_interval_seconds: value })}
        />

        {qrCurrent ? (
          <div className="space-y-4">
            <ModelSelect
              label={t('floorPlan.qrOrderMode')}
              value={qrCurrent.mode}
              disabled={!branchWrite || busy}
              hint={t('floorPlan.qrOrderModeHint')}
              options={QR_ORDER_MODES.map((value) => ({
                value,
                label: t(`floorPlan.qrMode_${value}`),
              }))}
              onChange={(value) => setQrEdits((prev) => ({ ...prev, mode: value as QrOrderMode }))}
            />
            {directMode ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={limitId}>{t('floorPlan.qrOrderLimit')}</Label>
                  <Input
                    id={limitId}
                    inputMode="numeric"
                    value={qrCurrent.limit}
                    disabled={!branchWrite || busy}
                    aria-invalid={qrLimitInvalid}
                    aria-describedby={`${limitId}-hint`}
                    onChange={(event) =>
                      setQrEdits((prev) => ({ ...prev, limit: event.target.value }))
                    }
                  />
                  <small
                    id={`${limitId}-hint`}
                    className={qrLimitInvalid ? 'text-destructive' : 'text-muted-foreground'}
                  >
                    {t(
                      qrLimitInvalid
                        ? 'floorPlan.qrOrderLimitInvalid'
                        : 'floorPlan.qrOrderLimitHint',
                    )}
                  </small>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={countId}>{t('floorPlan.qrOrderMaxItems')}</Label>
                  <Input
                    id={countId}
                    inputMode="numeric"
                    value={qrCurrent.maxItems}
                    disabled={!branchWrite || busy}
                    aria-invalid={qrMaxItemsInvalid}
                    aria-describedby={`${countId}-hint`}
                    onChange={(event) =>
                      setQrEdits((prev) => ({ ...prev, maxItems: event.target.value }))
                    }
                  />
                  <small
                    id={`${countId}-hint`}
                    className={qrMaxItemsInvalid ? 'text-destructive' : 'text-muted-foreground'}
                  >
                    {t('floorPlan.qrOrderMaxItemsHint', { max: QR_MAX_ITEMS })}
                  </small>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <SubHeading>{t('emenu.payment')}</SubHeading>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t('emenu.paymentTiming')}</legend>
          {(['pay_after', 'pay_before'] as const).map((timing) => (
            <label
              key={timing}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors has-[:disabled]:cursor-default ${
                current.payment_timing === timing
                  ? 'border-primary ring-1 ring-primary'
                  : 'hover:bg-muted'
              }`}
            >
              <input
                type="radio"
                name="emenu-payment-timing"
                className="mt-1 accent-primary"
                checked={current.payment_timing === timing}
                disabled={!emenuWrite || busy}
                onChange={() => patch({ payment_timing: timing })}
              />
              <span>
                <span className="block text-sm font-medium">
                  {t(timing === 'pay_after' ? 'emenu.payAfter' : 'emenu.payBefore')}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t(timing === 'pay_after' ? 'emenu.payAfterHint' : 'emenu.payBeforeHint')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <ToggleRow
          checked={current.pay_methods.includes('vietqr')}
          disabled={!emenuWrite || busy}
          label={t('emenu.methodVietqr')}
          description={!current.vietqr_available ? t('emenu.noVietqr') : undefined}
          switchLabel={t('emenu.methodVietqr')}
          onChange={(value) => toggleMethod('vietqr', value)}
        />
        <ToggleRow
          checked={current.pay_methods.includes('counter')}
          disabled={!emenuWrite || busy}
          label={t('emenu.methodCounter')}
          switchLabel={t('emenu.methodCounter')}
          onChange={(value) => toggleMethod('counter', value)}
        />
        {current.pay_methods.length === 0 ? (
          <p className="text-sm text-destructive">{t('emenu.methodRequired')}</p>
        ) : null}
        {prepay && current.pay_methods.includes('vietqr') ? (
          <NumberField
            label={t('emenu.prepayTimeoutLabel')}
            value={current.prepay_timeout_minutes}
            min={1}
            max={60}
            disabled={!emenuWrite || busy}
            invalid={tooLong}
            hint={
              tooLong
                ? t('emenu.prepayTooLong', { minutes: current.vietqr_timeout_minutes })
                : t('emenu.prepayTimeout', { minutes: current.vietqr_timeout_minutes })
            }
            onChange={(value) => patch({ prepay_timeout_minutes: value })}
          />
        ) : null}
        <SaveRow
          notice={notice}
          busy={busy}
          dirty={dirty}
          canSave={canSave}
          onDiscard={() => {
            setNotice(null)
            draft.discard(EXTRA_KEYS)
            setQrEdits({})
          }}
        />
      </form>
    </ModelCard>
  )
}
