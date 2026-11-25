import { type BusinessProfile, profileLabelKey } from '@shared/pos-modules'
import { describeFailure } from '@shared/request-failure'
import {
  addressLine,
  type StoreInfoDraft,
  storeInfoFilled,
  suggestedCutoff,
} from '@shared/store-info'
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SectionTitle,
} from '@spree/dashboard-ui'
import { Building2Icon, StoreIcon } from '@spree/dashboard-ui/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronDown, Database, Trash2 } from 'lucide-react'
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { AddressDialog } from '../components/address-dialog'
import { PageSkeleton } from '../components/page-skeleton'
import {
  ModelCard,
  ModelCheck,
  ModelNotice,
  ModelPage,
  ModelState,
} from '../components/setup/model-ui'
import { useBusinessProfiles } from '../hooks/use-business-profiles'
import { refreshBusinessModel } from '../hooks/use-onboarding'
import { usePosContext } from '../hooks/use-pos-context'
import {
  clearStoreLogo,
  type DangerZoneBranch,
  deleteCurrentStore,
  deleteStoreBranch,
  resetStoreOrBranchData,
  type StoreInfoRecord,
  saveStoreInfo,
  uploadStoreLogo,
  useStoreBranches,
  useStoreInfo,
} from '../hooks/use-store-info'

type Draft = StoreInfoDraft & {
  cutoff: string
  interests: string[]
  provinceName: string
  wardName: string
}

function draftFrom(record: StoreInfoRecord): Draft {
  return {
    logo: Boolean(record.logo_url),
    name: record.name ?? record.fallback.name ?? '',
    phone: record.phone ?? record.fallback.phone ?? '',
    adminEmail: record.admin_email ?? '',
    contactEmail: record.contact_email ?? record.fallback.contact_email ?? '',
    taxCode: record.tax_code ?? '',
    identityNumber: record.representative_id_number ?? '',
    profileKeys: record.profile_keys.length
      ? record.profile_keys
      : record.profile_key
        ? [record.profile_key]
        : [],
    opening: record.opening_time ?? '',
    closing: record.closing_time ?? '',
    provinceCode: record.province_code ?? '',
    wardCode: record.ward_code ?? '',
    street: record.street ?? '',
    description: record.description ?? '',
    cutoff: record.business_day_cutoff,
    interests: record.interests,
    provinceName: record.province_name ?? '',
    wardName: record.ward_name ?? '',
  }
}

export function StoreInfoPage() {
  const { t } = useTranslation()
  const context = usePosContext()
  const storeId = context.data?.store.id ?? null
  const write = context.data?.administration?.write === true
  const info = useStoreInfo(storeId, Boolean(storeId))
  const catalogue = useBusinessProfiles(storeId, write)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const [actions, setActions] = useState<ReactNode>(null)
  return (
    <ModelPage title={t('storeInfo.title')} actions={actions}>
      <ModelNotice notice={notice} />
      {context.isPending || info.isPending ? (
        <PageSkeleton />
      ) : context.isError || info.isError ? (
        <ModelState error title={t('storeInfo.loadError')} retry={() => void info.refetch()} />
      ) : info.data ? (
        <StoreInfoForm
          key={`${info.data.name ?? ''}:${info.data.phone ?? ''}:${info.data.profile_keys.join()}`}
          record={info.data}
          profiles={catalogue.data?.profiles ?? []}
          write={write}
          storeId={storeId}
          onSaved={() => {
            setNotice({ text: t('storeInfo.saved'), failed: false })
            void info.refetch()
          }}
          onActions={setActions}
        />
      ) : null}
    </ModelPage>
  )
}

function StoreInfoForm({
  record,
  profiles,
  write,
  storeId,
  onSaved,
  onActions,
}: {
  record: StoreInfoRecord
  profiles: BusinessProfile[]
  write: boolean
  storeId: string | null
  onSaved: () => void
  onActions: (actions: ReactNode) => void
}) {
  const { t } = useTranslation()
  const initial = useMemo(() => draftFrom(record), [record])
  const [draft, setDraft] = useState(initial)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const [addressOpen, setAddressOpen] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const filled = storeInfoFilled(draft)
  const suggestion = suggestedCutoff(draft.closing)
  const mutation = useMutation({
    mutationFn: async () => {
      const saved = await saveStoreInfo({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        admin_email: draft.adminEmail.trim() || null,
        contact_email: draft.contactEmail.trim() || null,
        tax_code: draft.taxCode.trim() || null,
        representative_id_number: draft.identityNumber.trim() || null,
        opening_time: draft.opening || null,
        closing_time: draft.closing || null,
        business_day_cutoff: draft.cutoff,
        province_code: draft.provinceCode || null,
        ward_code: draft.wardCode || null,
        street: draft.street.trim() || null,
        description: draft.description.trim() || null,
        profile_keys: draft.profileKeys,
        interests: draft.interests,
        reason: 'store_info',
      })
      return saved
    },
  })
  function patch(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }))
  }
  async function save() {
    setNotice(null)
    try {
      await mutation.mutateAsync()
      await refreshBusinessModel(storeId ?? undefined)
      onSaved()
    } catch (error) {
      setNotice({ text: describeFailure(error, t), failed: true })
    }
  }
  const handlers = useRef({ revert: () => setDraft(initial), save })
  handlers.current = { revert: () => setDraft(initial), save }
  const canSave = write && dirty && !mutation.isPending && draft.profileKeys.length > 0
  useLayoutEffect(() => {
    onActions(
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || mutation.isPending}
          onClick={() => handlers.current.revert()}
        >
          {t('storeInfo.revert')}
        </Button>
        <Button type="button" disabled={!canSave} onClick={() => void handlers.current.save()}>
          {t('storeInfo.save')}
        </Button>
      </div>,
    )
    return () => onActions(null)
  }, [canSave, dirty, mutation.isPending, onActions, t])
  const line = addressLine({
    street: draft.street,
    wardName: draft.wardName,
    provinceName: draft.provinceName,
  })
  const logo = record.logo_url || record.fallback.logo_url
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('storeInfo.filled', { count: filled, total: 11 })}
      </p>
      <ModelNotice notice={notice} />
      <ModelCard title={t('storeInfo.general')} id="store-info-general" icon={<Building2Icon />}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            {logo ? (
              <img src={logo} alt="" className="h-16 w-16 rounded-md border object-contain" />
            ) : null}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {record.logo_url ? t('storeInfo.logoCustom') : t('storeInfo.logoDefault')}
              </p>
              {write ? (
                <div className="flex flex-wrap gap-2">
                  <Label className="inline-flex">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/x-icon"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => {
                          const data = typeof reader.result === 'string' ? reader.result : ''
                          void uploadStoreLogo({
                            data,
                            filename: file.name,
                            content_type: file.type,
                          }).then(() => onSaved())
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                    <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                      {t('storeInfo.chooseLogo')}
                    </span>
                  </Label>
                  {record.logo_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void clearStoreLogo().then(() => onSaved())}
                    >
                      {t('storeInfo.logoReset')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <Field
            label={t('storeInfo.name')}
            value={draft.name}
            disabled={!write}
            onChange={(name) => patch({ name })}
          />
          <Field
            label={t('storeInfo.phone')}
            value={draft.phone}
            disabled={!write}
            onChange={(phone) => patch({ phone })}
          />
          <Field
            label={t('storeInfo.adminEmail')}
            value={draft.adminEmail}
            disabled={!write}
            onChange={(adminEmail) => patch({ adminEmail })}
          />
          <Field
            label={t('storeInfo.contactEmail')}
            value={draft.contactEmail}
            disabled={!write}
            onChange={(contactEmail) => patch({ contactEmail })}
          />
          <Field
            label={t('storeInfo.taxCode')}
            value={draft.taxCode}
            disabled={!write}
            onChange={(taxCode) => patch({ taxCode })}
          />
          <Field
            label={t('storeInfo.identity')}
            value={draft.identityNumber}
            disabled={!write}
            placeholder={
              record.representative_id_set && !record.representative_id_number ? '********' : ''
            }
            onChange={(identityNumber) => patch({ identityNumber })}
          />
          <ProfileTags
            profiles={profiles.filter((profile) => profile.status === 'available')}
            keys={draft.profileKeys}
            disabled={!write}
            onChange={(profileKeys) => patch({ profileKeys })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('storeInfo.opening')}
              type="time"
              value={draft.opening}
              disabled={!write}
              onChange={(opening) => patch({ opening })}
            />
            <Field
              label={t('storeInfo.closing')}
              type="time"
              value={draft.closing}
              disabled={!write}
              onChange={(closing) => patch({ closing })}
            />
          </div>
          <div className="space-y-2">
            <Field
              label={t('storeInfo.cutoff')}
              type="time"
              value={draft.cutoff}
              disabled={!write}
              onChange={(cutoff) => patch({ cutoff })}
            />
            <p className="text-sm text-muted-foreground">{t('storeInfo.cutoffHelp')}</p>
            {write && suggestion && suggestion !== draft.cutoff ? (
              <Button type="button" variant="outline" onClick={() => patch({ cutoff: suggestion })}>
                {t('storeInfo.useClosing')}
              </Button>
            ) : null}
            {record.open_shifts > 0 ? <p className="text-sm">{t('storeInfo.openShifts')}</p> : null}
          </div>
          {profiles.some((profile) => profile.status === 'coming_soon') ? (
            <fieldset className="space-y-3">
              <legend>{t('businessModel.storeInterests')}</legend>
              {profiles
                .filter((profile) => profile.status === 'coming_soon')
                .map((profile) => (
                  <ModelCheck
                    key={profile.key}
                    checked={draft.interests.includes(profile.key)}
                    disabled={!write}
                    onChange={(value) =>
                      patch({
                        interests: value
                          ? [...draft.interests, profile.key]
                          : draft.interests.filter((key) => key !== profile.key),
                      })
                    }
                  >
                    {t(profileLabelKey(profile.key), { defaultValue: profile.key })}
                  </ModelCheck>
                ))}
            </fieldset>
          ) : null}
        </div>
      </ModelCard>
      <ModelCard title={t('storeInfo.other')} id="store-info-other" icon={<StoreIcon />}>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('storeInfo.address')}</p>
            <p>{line || record.fallback.address || t('storeInfo.addressEmpty')}</p>
            {write ? (
              <Button type="button" variant="outline" onClick={() => setAddressOpen(true)}>
                {t('storeInfo.chooseAddress')}
              </Button>
            ) : null}
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium">{t('storeInfo.description')}</span>
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
              maxLength={1000}
              value={draft.description}
              disabled={!write}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>
        </div>
      </ModelCard>
      {addressOpen ? (
        <AddressDialog
          provinceCode={draft.provinceCode}
          wardCode={draft.wardCode}
          street={draft.street}
          onClose={() => setAddressOpen(false)}
          onPick={(address) => {
            patch(address)
            setAddressOpen(false)
          }}
        />
      ) : null}
      <DangerZoneSection
        storeId={storeId}
        storeName={draft.name.trim() || record.fallback.name || ''}
        write={write}
        onNotice={setNotice}
      />
    </div>
  )
}

function DangerZoneSection({
  storeId,
  storeName,
  write,
  onNotice,
}: {
  storeId: string | null
  storeName: string
  write: boolean
  onNotice: (notice: { text: string; failed: boolean } | null) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const branchesQuery = useStoreBranches(storeId, Boolean(storeId))
  const branches = branchesQuery.data ?? []

  const [resetOpen, setResetOpen] = useState(false)
  const [deleteBranchOpen, setDeleteBranchOpen] = useState(false)
  const [deleteStoreOpen, setDeleteStoreOpen] = useState(false)

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="store-info-danger-zone"
      data-testid="store-danger-zone"
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <SectionTitle id="store-info-danger-zone" className="text-destructive">
          <AlertTriangle className="size-4 text-destructive" aria-hidden />
          {t('storeInfo.dangerZone.title')}
        </SectionTitle>
      </div>
      <Card className="border-destructive/40">
        <CardContent>
          <div className="flex flex-col divide-y divide-border">
            <p className="pb-4 text-sm text-muted-foreground">
              {t('storeInfo.dangerZone.subtitle')}
            </p>

            {/* 1. Reset Data (Store or Branch) */}
            <div className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Database className="size-4 text-destructive" aria-hidden />
                  <span>{t('storeInfo.dangerZone.resetTitle')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('storeInfo.dangerZone.resetDesc')}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="shrink-0"
                disabled={!write}
                onClick={() => setResetOpen(true)}
                data-testid="danger-zone-reset-btn"
              >
                {t('storeInfo.dangerZone.resetButton')}
              </Button>
            </div>

            {/* 2. Delete Single Branch */}
            <div className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                  <span>{t('storeInfo.dangerZone.deleteBranchTitle')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('storeInfo.dangerZone.deleteBranchDesc')}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="shrink-0"
                disabled={!write || branches.length === 0}
                onClick={() => setDeleteBranchOpen(true)}
                data-testid="danger-zone-delete-branch-btn"
              >
                {t('storeInfo.dangerZone.deleteBranchButton')}
              </Button>
            </div>

            {/* 3. Delete Store */}
            <div className="flex flex-col justify-between gap-3 pt-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                  <span>{t('storeInfo.dangerZone.deleteStoreTitle')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('storeInfo.dangerZone.deleteStoreDesc')}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="shrink-0"
                disabled={!write}
                onClick={() => setDeleteStoreOpen(true)}
                data-testid="danger-zone-delete-store-btn"
              >
                {t('storeInfo.dangerZone.deleteStoreButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {resetOpen ? (
        <ResetDataDialog
          storeName={storeName}
          branches={branches}
          onClose={() => setResetOpen(false)}
          onDone={(message) => {
            setResetOpen(false)
            onNotice({ text: message, failed: false })
            void queryClient.invalidateQueries()
          }}
        />
      ) : null}

      {deleteBranchOpen ? (
        <DeleteBranchDialog
          branches={branches}
          onClose={() => setDeleteBranchOpen(false)}
          onDone={(message) => {
            setDeleteBranchOpen(false)
            onNotice({ text: message, failed: false })
            void branchesQuery.refetch()
            void queryClient.invalidateQueries()
          }}
        />
      ) : null}

      {deleteStoreOpen ? (
        <DeleteStoreDialog
          storeName={storeName}
          onClose={() => setDeleteStoreOpen(false)}
          onDone={(result) => {
            setDeleteStoreOpen(false)
            onNotice({
              text: t('storeInfo.dangerZone.deleteStoreSuccess', {
                store: result.deleted_store_name,
              }),
              failed: false,
            })
            void queryClient.invalidateQueries()
            if (result.next_store_id) {
              void navigate({ to: '/$storeId', params: { storeId: result.next_store_id } })
            }
          }}
        />
      ) : null}
    </section>
  )
}

function ResetDataDialog({
  storeName,
  branches,
  onClose,
  onDone,
}: {
  storeName: string
  branches: DangerZoneBranch[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { t } = useTranslation()
  const [scope, setScope] = useState<'store' | 'branch'>('store')
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? '')
  const [wipeTransactions, setWipeTransactions] = useState(true)
  const [wipeCatalog, setWipeCatalog] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)

  const selectedBranch = branches.find((b) => b.id === branchId) ?? branches[0] ?? null
  const targetName = scope === 'branch' ? (selectedBranch?.name ?? '') : storeName
  const confirmationMatches =
    targetName.trim() !== '' &&
    confirmation.trim().toLowerCase() === targetName.trim().toLowerCase()
  const canSubmit =
    (wipeTransactions || wipeCatalog) &&
    confirmationMatches &&
    (scope === 'store' || Boolean(selectedBranch))

  const mutation = useMutation({
    mutationFn: () =>
      resetStoreOrBranchData({
        scope,
        branch_id: scope === 'branch' ? selectedBranch?.id : null,
        wipe_transactions: wipeTransactions,
        wipe_catalog: wipeCatalog,
        confirmation: confirmation.trim(),
      }),
  })

  async function handleConfirm() {
    setErrorText(null)
    try {
      const result = await mutation.mutateAsync()
      const message =
        result.scope === 'branch'
          ? t('storeInfo.dangerZone.resetSuccessBranch', {
              branch: result.branch_name ?? '',
              count: result.deleted_counts.total,
            })
          : t('storeInfo.dangerZone.resetSuccessStore', {
              count: result.deleted_counts.total,
            })
      onDone(message)
    } catch (error) {
      setErrorText(describeFailure(error, t))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('storeInfo.dangerZone.resetTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {errorText ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorText}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{t('storeInfo.dangerZone.scopeLabel')}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setScope('store')
                  setConfirmation('')
                }}
                className={`rounded-md border p-3 text-left text-sm transition ${
                  scope === 'store'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border hover:bg-muted/50'
                }`}
                data-testid="reset-scope-store"
              >
                <div className="font-medium">{t('storeInfo.dangerZone.scopeStore')}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t('storeInfo.dangerZone.scopeStoreDesc')}
                </div>
              </button>
              <button
                type="button"
                disabled={branches.length === 0}
                onClick={() => {
                  setScope('branch')
                  if (!branchId && branches[0]) setBranchId(branches[0].id)
                  setConfirmation('')
                }}
                className={`rounded-md border p-3 text-left text-sm transition disabled:opacity-50 ${
                  scope === 'branch'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border hover:bg-muted/50'
                }`}
                data-testid="reset-scope-branch"
              >
                <div className="font-medium">{t('storeInfo.dangerZone.scopeBranch')}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t('storeInfo.dangerZone.scopeBranchDesc')}
                </div>
              </button>
            </div>
          </div>

          {scope === 'branch' ? (
            <div className="space-y-1.5">
              <Label htmlFor="danger-reset-branch">{t('storeInfo.dangerZone.selectBranch')}</Label>
              <select
                id="danger-reset-branch"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedBranch?.id ?? ''}
                onChange={(e) => {
                  setBranchId(e.target.value)
                  setConfirmation('')
                }}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.is_default ? ` (${t('storeInfo.dangerZone.defaultBadge')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2.5 rounded-md border p-3">
            <p className="text-sm font-medium">{t('storeInfo.dangerZone.dataIncluded')}</p>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={wipeTransactions}
                onCheckedChange={(checked) => setWipeTransactions(checked === true)}
              />
              <span>{t('storeInfo.dangerZone.wipeTransactions')}</span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={wipeCatalog}
                onCheckedChange={(checked) => setWipeCatalog(checked === true)}
              />
              <span>
                {t('storeInfo.dangerZone.wipeCatalog')}
                {scope === 'branch' ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t('storeInfo.dangerZone.wipeCatalogBranchHint')}
                  </span>
                ) : null}
              </span>
            </label>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('storeInfo.dangerZone.staffPreservedNote')}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="danger-reset-confirm">
              {t('storeInfo.dangerZone.confirmLabel', { name: targetName })}
            </Label>
            <Input
              id="danger-reset-confirm"
              value={confirmation}
              placeholder={t('storeInfo.dangerZone.confirmPlaceholder')}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('storeInfo.dangerZone.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => void handleConfirm()}
            data-testid="danger-reset-submit"
          >
            {mutation.isPending
              ? t('storeInfo.dangerZone.processing')
              : t('storeInfo.dangerZone.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteBranchDialog({
  branches,
  onClose,
  onDone,
}: {
  branches: DangerZoneBranch[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { t } = useTranslation()
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? '')
  const [confirmation, setConfirmation] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)

  const selectedBranch = branches.find((b) => b.id === branchId) ?? branches[0] ?? null
  const targetName = selectedBranch?.name ?? ''
  const confirmationMatches =
    targetName.trim() !== '' &&
    confirmation.trim().toLowerCase() === targetName.trim().toLowerCase()

  const mutation = useMutation({
    mutationFn: () =>
      deleteStoreBranch({
        branch_id: selectedBranch?.id ?? '',
        confirmation: confirmation.trim(),
      }),
  })

  async function handleConfirm() {
    if (!selectedBranch) return
    setErrorText(null)
    try {
      const result = await mutation.mutateAsync()
      onDone(
        t('storeInfo.dangerZone.deleteBranchSuccess', {
          branch: result.deleted_branch_name,
        }),
      )
    } catch (error) {
      setErrorText(describeFailure(error, t))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('storeInfo.dangerZone.deleteBranchModalTitle', { name: targetName })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {errorText ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorText}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="danger-delete-branch">{t('storeInfo.dangerZone.selectBranch')}</Label>
            <select
              id="danger-delete-branch"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedBranch?.id ?? ''}
              onChange={(e) => {
                setBranchId(e.target.value)
                setConfirmation('')
              }}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.is_default ? ` (${t('storeInfo.dangerZone.defaultBadge')})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('storeInfo.dangerZone.deleteBranchWarning', { name: targetName })}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="danger-delete-branch-confirm">
              {t('storeInfo.dangerZone.confirmLabel', { name: targetName })}
            </Label>
            <Input
              id="danger-delete-branch-confirm"
              value={confirmation}
              placeholder={t('storeInfo.dangerZone.confirmPlaceholder')}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('storeInfo.dangerZone.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!selectedBranch || !confirmationMatches || mutation.isPending}
            onClick={() => void handleConfirm()}
            data-testid="danger-delete-branch-submit"
          >
            {mutation.isPending
              ? t('storeInfo.dangerZone.processing')
              : t('storeInfo.dangerZone.confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteStoreDialog({
  storeName,
  onClose,
  onDone,
}: {
  storeName: string
  onClose: () => void
  onDone: (result: { deleted_store_id: string; deleted_store_name: string; next_store_id: string }) => void
}) {
  const { t } = useTranslation()
  const [confirmation, setConfirmation] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)

  const confirmationMatches =
    storeName.trim() !== '' &&
    confirmation.trim().toLowerCase() === storeName.trim().toLowerCase()

  const mutation = useMutation({
    mutationFn: () => deleteCurrentStore({ confirmation: confirmation.trim() }),
  })

  async function handleConfirm() {
    setErrorText(null)
    try {
      const result = await mutation.mutateAsync()
      onDone(result)
    } catch (error) {
      setErrorText(describeFailure(error, t))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('storeInfo.dangerZone.deleteStoreModalTitle', { name: storeName })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {errorText ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorText}
            </div>
          ) : null}

          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('storeInfo.dangerZone.deleteStoreWarning')}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="danger-delete-store-confirm">
              {t('storeInfo.dangerZone.confirmLabel', { name: storeName })}
            </Label>
            <Input
              id="danger-delete-store-confirm"
              value={confirmation}
              placeholder={t('storeInfo.dangerZone.confirmPlaceholder')}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('storeInfo.dangerZone.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmationMatches || mutation.isPending}
            onClick={() => void handleConfirm()}
            data-testid="danger-delete-store-submit"
          >
            {mutation.isPending
              ? t('storeInfo.dangerZone.processing')
              : t('storeInfo.dangerZone.confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: string
  placeholder?: string
}) {
  const id = `store-info-${label}`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function fold(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase()
}

function ProfileTags({
  profiles,
  keys,
  disabled,
  onChange,
}: {
  profiles: BusinessProfile[]
  keys: string[]
  disabled: boolean
  onChange: (keys: string[]) => void
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const listId = useId()
  const field = useRef<HTMLInputElement>(null)
  const skipOpen = useRef(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const label = (key: string) => t(profileLabelKey(key), { defaultValue: key })
  const typed = fold(query.trim())
  const matches = profiles.filter((profile) => {
    if (keys.includes(profile.key)) return false
    return typed.length === 0 || fold(label(profile.key)).includes(typed)
  })
  const current = matches[Math.min(active, Math.max(matches.length - 1, 0))]
  const showList = open && matches.length > 0
  function add(key: string) {
    if (disabled || keys.includes(key)) return
    onChange([...keys, key])
    setQuery('')
    setActive(0)
    setOpen(false)
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && matches.length > 0) {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(0)
        return
      }
      setActive((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp' && matches.length > 0) {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (current) add(current.key)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Backspace' && query === '' && keys.length > 1) {
      onChange(keys.slice(0, -1))
    }
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{t('storeInfo.profiles')}</Label>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
          {keys.map((key, index) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-sm"
            >
              {label(key)}
              {index === 0 ? (
                <span className="text-xs text-muted-foreground">{t('storeInfo.primary')}</span>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground"
                  disabled={disabled}
                  onClick={() => onChange([key, ...keys.filter((item) => item !== key)])}
                >
                  {t('storeInfo.makePrimary')}
                </button>
              )}
              <button
                type="button"
                className="text-muted-foreground"
                aria-label={t('storeInfo.removeProfile', { name: label(key) })}
                disabled={disabled || keys.length === 1}
                onClick={() => onChange(keys.filter((item) => item !== key))}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={field}
            id={inputId}
            role="combobox"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={showList && current ? `${listId}-${current.key}` : undefined}
            className="min-w-40 flex-1 bg-transparent py-1 text-sm outline-none disabled:cursor-not-allowed"
            placeholder={t('storeInfo.addProfile')}
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => {
              if (skipOpen.current) {
                skipOpen.current = false
                return
              }
              setOpen(true)
            }}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            tabIndex={-1}
            className="ml-auto text-muted-foreground"
            aria-label={t('storeInfo.addProfile')}
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault()
              const next = !open
              if (!next && document.activeElement === field.current) {
                setOpen(false)
                return
              }
              if (!next) skipOpen.current = true
              setOpen(next)
              field.current?.focus()
            }}
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
        {showList ? (
          <div
            id={listId}
            role="listbox"
            tabIndex={-1}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-background p-1 shadow-md"
          >
            {matches.map((profile) => (
              <div
                key={profile.key}
                id={`${listId}-${profile.key}`}
                role="option"
                tabIndex={-1}
                aria-selected={profile.key === current?.key}
                className="cursor-pointer rounded-md px-2 py-1.5 text-sm aria-selected:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(matches.indexOf(profile))}
                onClick={() => add(profile.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') add(profile.key)
                }}
              >
                {label(profile.key)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t('storeInfo.profileNote')}</p>
    </div>
  )
}
