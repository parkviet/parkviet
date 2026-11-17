import { type BusinessProfile, profileLabelKey } from '@parkviet/pos-shared/pos-modules'
import { describeFailure } from '@parkviet/pos-shared/request-failure'
import {
  addressLine,
  type StoreInfoDraft,
  storeInfoFilled,
  suggestedCutoff,
} from '@parkviet/pos-shared/store-info'
import { Button, Input, Label } from '@spree/dashboard-ui'
import { Building2Icon, StoreIcon } from '@spree/dashboard-ui/icons'
import { useMutation } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
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
  type StoreInfoRecord,
  saveStoreInfo,
  uploadStoreLogo,
  useProvinces,
  useStoreInfo,
  useWards,
} from '../hooks/use-store-info'

type Draft = StoreInfoDraft & {
  cutoff: string
  wholesale: boolean
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
    wholesale: record.wholesale,
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
        wholesale: draft.wholesale,
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
          <ModelCheck
            checked={draft.wholesale}
            disabled={!write}
            onChange={(wholesale) => patch({ wholesale })}
          >
            {t('businessModel.storeWholesale')}
          </ModelCheck>
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
    </div>
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

function AddressDialog({
  provinceCode,
  wardCode,
  street,
  onClose,
  onPick,
}: {
  provinceCode: string
  wardCode: string
  street: string
  onClose: () => void
  onPick: (
    value: Pick<Draft, 'provinceCode' | 'wardCode' | 'street' | 'provinceName' | 'wardName'>,
  ) => void
}) {
  const { t } = useTranslation()
  const provinces = useProvinces(true)
  const [province, setProvince] = useState(provinceCode)
  const [ward, setWard] = useState(wardCode)
  const [road, setRoad] = useState(street)
  const wards = useWards(province || null)
  const provinceName = provinces.data?.find((row) => row.code === province)?.name ?? ''
  const wardName = wards.data?.find((row) => row.code === ward)?.name ?? ''
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('storeInfo.chooseAddress')}
        className="w-full max-w-lg space-y-4 rounded-lg bg-background p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onPick({ provinceCode: province, wardCode: ward, street: road, provinceName, wardName })
        }}
      >
        <label className="block space-y-2">
          <span>{t('storeInfo.province')}</span>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={province}
            onChange={(event) => {
              setProvince(event.target.value)
              setWard('')
            }}
          >
            <option value="">{t('storeInfo.province')}</option>
            {(provinces.data ?? []).map((row) => (
              <option key={row.code} value={row.code}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span>{t('storeInfo.ward')}</span>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={ward}
            onChange={(event) => setWard(event.target.value)}
          >
            <option value="">{t('storeInfo.ward')}</option>
            {(wards.data ?? []).map((row) => (
              <option key={row.code} value={row.code}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <Field label={t('storeInfo.street')} value={road} disabled={false} onChange={setRoad} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('storeInfo.revert')}
          </Button>
          <Button type="submit" disabled={!province || !ward || !road.trim()}>
            {t('storeInfo.chooseAddress')}
          </Button>
        </div>
      </form>
    </div>
  )
}
