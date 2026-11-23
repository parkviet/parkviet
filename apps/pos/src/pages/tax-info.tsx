import { conflictReason, describeFailure } from '@shared/request-failure'
import { addressLine } from '@shared/store-info'
import { mapSpreeErrorsToForm } from '@spree/dashboard-core'
import { Button, Textarea } from '@spree/dashboard-ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Building2, FileText, MapPin, PenLine } from 'lucide-react'
import { useState } from 'react'
import { type FieldPath, type FieldPathValue, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AddressDialog } from '../components/address-dialog'
import { CatalogCombobox } from '../components/catalog-combobox'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelCard, ModelNotice, ModelPage, ModelState } from '../components/setup/model-ui'
import { Input, TopologyField, TopologySelect } from '../components/topology-fields'
import { usePosContext } from '../hooks/use-pos-context'
import { useSession } from '../hooks/use-session'
import {
  saveTaxProfile,
  TAX_PERIODS,
  type TaxCatalog,
  type TaxProfileRecord,
  useTaxCatalog,
  useTaxProfile,
} from '../hooks/use-tax-profile'
import { posKey } from '../lib/query-keys'
import { type TaxInfoValues, taxInfoBody, taxInfoSchema, taxInfoValues } from '../schemas/tax-info'

type Notice = { text: string; failed: boolean } | null

export function TaxInfoPage() {
  const { t } = useTranslation()
  const context = usePosContext()
  const storeId = context.data?.store.id ?? null
  const write = context.data?.administration?.write === true
  const profile = useTaxProfile(storeId, Boolean(storeId))
  const catalog = useTaxCatalog(Boolean(storeId))
  const queryClient = useQueryClient()
  const session = useSession()
  const [notice, setNotice] = useState<Notice>(null)
  // The form remounts on its saved record only; a background refetch keeps the draft.
  const [saves, setSaves] = useState(0)
  return (
    <ModelPage title={t('taxInfo.title')}>
      {context.isPending || profile.isPending || catalog.isPending ? (
        <PageSkeleton />
      ) : context.isError ||
        profile.isError ||
        catalog.isError ||
        !profile.data ||
        !catalog.data ? (
        <ModelState
          error
          title={t('taxInfo.loadError')}
          retry={() => {
            void profile.refetch()
            void catalog.refetch()
          }}
        />
      ) : (
        <TaxInfoForm
          key={saves}
          record={profile.data}
          catalog={catalog.data}
          write={write}
          storeId={storeId}
          notice={notice}
          onNotice={setNotice}
          onSaved={(saved) => {
            // The form remounts on the saved record, with the new readiness.
            queryClient.setQueryData(posKey(session.storeId, 'tax-profile', storeId), saved)
            setSaves((count) => count + 1)
            setNotice({ text: t('taxInfo.saved'), failed: false })
            void queryClient.invalidateQueries({ queryKey: ['pos', session.storeId, 'store-info'] })
          }}
        />
      )}
    </ModelPage>
  )
}

function TaxInfoForm({
  record,
  catalog,
  write,
  storeId,
  notice,
  onNotice,
  onSaved,
}: {
  record: TaxProfileRecord
  catalog: TaxCatalog
  write: boolean
  storeId: string | null
  notice: Notice
  onNotice: (notice: Notice) => void
  onSaved: (saved: TaxProfileRecord) => void
}) {
  const { t } = useTranslation()
  const form = useForm<TaxInfoValues>({ defaultValues: taxInfoValues(record) })
  const values = form.watch()
  const errors = form.formState.errors
  const busy = form.formState.isSubmitting
  const dirty = form.formState.isDirty
  const [addressOpen, setAddressOpen] = useState(false)
  const canEdit = write && record.store_info_saved
  const set = <K extends FieldPath<TaxInfoValues>>(
    key: K,
    value: FieldPathValue<TaxInfoValues, K>,
  ) => {
    form.setValue(key, value, { shouldDirty: true })
    // Errors here are set by hand (fields are not registered), so editing
    // a field is what clears its message.
    form.clearErrors(key.startsWith('locations.') ? 'locations' : key)
  }

  async function submit(draft: TaxInfoValues) {
    form.clearErrors()
    onNotice(null)
    const parsed = taxInfoSchema.safeParse(draft)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] === 'locations' ? 'locations' : issue.path.join('.')
        form.setError(path as FieldPath<TaxInfoValues>, { message: t(issue.message) })
      }
      return
    }
    try {
      onSaved(await saveTaxProfile(taxInfoBody(parsed.data)))
    } catch (failure) {
      const reason = conflictReason(failure)
      if (reason === 'store_info_required' || reason === 'tax_head_office_invalid') {
        onNotice({ text: t(`taxInfo.reason_${reason}`), failed: true })
        return
      }
      if (!mapSpreeErrorsToForm(failure, form.setError))
        onNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const text = (
    key:
      | 'name'
      | 'tax_code'
      | 'legacy_tax_code'
      | 'store_code'
      | 'business_area_m2'
      | 'signer_name'
      | 'preparer_name'
      | 'storekeeper_name'
      | 'cashier_name',
    hint?: string,
    inputMode?: 'numeric' | 'decimal',
  ) => (
    <TopologyField label={t(`taxInfo.field_${key}`)} hint={hint} error={errors[key]?.message}>
      {(id, describedBy) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={Boolean(errors[key])}
          inputMode={inputMode}
          disabled={!canEdit || busy}
          value={values[key]}
          onChange={(event) => set(key, event.target.value)}
        />
      )}
    </TopologyField>
  )
  const shared = t('taxInfo.shared')
  const address = addressLine({
    street: values.street,
    wardName: values.ward_name,
    provinceName: values.province_name,
  })
  const missing = record.readiness.missing.map((field) => t(`taxInfo.required_${field}`))

  return (
    <>
      <form
        className="space-y-6 pb-4"
        aria-busy={busy}
        onSubmit={(event) => {
          // Hand-set errors would otherwise block handleSubmit; submit checks again.
          form.clearErrors()
          void form.handleSubmit(submit)(event)
        }}
      >
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t('taxInfo.intro')}</p>
          <p className="text-sm font-medium" data-testid="tax-info-readiness">
            {t('taxInfo.readiness', {
              count: record.readiness.filled,
              total: record.readiness.total,
            })}
          </p>
          {missing.length > 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="tax-info-missing">
              {t('taxInfo.missing', { list: missing.join(', ') })}
            </p>
          ) : null}
        </div>
        {!record.store_info_saved ? (
          <div role="status" className="rounded-md border p-3 text-sm">
            {t('taxInfo.storeInfoFirst')}{' '}
            {storeId ? (
              <Link
                to={`/${storeId}/settings/store-info` as string}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('storeInfo.title')}
              </Link>
            ) : null}
          </div>
        ) : null}

        <ModelCard title={t('taxInfo.taxpayer')} id="tax-info-taxpayer" icon={<Building2 />}>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('name', shared)}
            {text('tax_code', `${t('taxInfo.taxCodeHint')} ${shared}`, 'numeric')}
            {text('legacy_tax_code', t('taxInfo.legacyTaxCodeHint'), 'numeric')}
            {text('store_code')}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('taxInfo.field_address')}</p>
            <p>{address || t('storeInfo.addressEmpty')}</p>
            <p className="text-sm text-muted-foreground">{shared}</p>
            {errors.street || errors.ward_code || errors.province_code ? (
              <p className="text-sm text-destructive">
                {(errors.street ?? errors.ward_code ?? errors.province_code)?.message}
              </p>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="outline" onClick={() => setAddressOpen(true)}>
                {t('storeInfo.chooseAddress')}
              </Button>
            ) : null}
          </div>
          <TopologyField
            label={t('taxInfo.field_description')}
            hint={shared}
            error={errors.description?.message}
          >
            {(id, describedBy) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                maxLength={1000}
                disabled={!canEdit || busy}
                value={values.description}
                onChange={(event) => set('description', event.target.value)}
              />
            )}
          </TopologyField>
        </ModelCard>

        <ModelCard title={t('taxInfo.declaration')} id="tax-info-declaration" icon={<FileText />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TopologyField
              label={t('taxInfo.field_declaration_period')}
              error={errors.declaration_period?.message}
            >
              {(id) => (
                <TopologySelect
                  id={id}
                  value={values.declaration_period}
                  disabled={!canEdit || busy}
                  invalid={Boolean(errors.declaration_period)}
                  options={[
                    { value: '', label: t('taxInfo.periodNone') },
                    ...TAX_PERIODS.map((value) => ({ value, label: t(`taxInfo.period_${value}`) })),
                  ]}
                  onChange={(value) =>
                    set('declaration_period', value as TaxInfoValues['declaration_period'])
                  }
                />
              )}
            </TopologyField>
            {text('business_area_m2', t('taxInfo.areaHint'), 'decimal')}
          </div>
          <TopologyField
            label={t('taxInfo.field_tax_authority_code')}
            hint={catalog.tax_authorities.verified ? undefined : t('taxInfo.catalogUnverified')}
            error={errors.tax_authority_code?.message}
          >
            {(id, describedBy) => (
              <CatalogCombobox
                id={id}
                describedBy={describedBy}
                value={values.tax_authority_code}
                options={catalog.tax_authorities.items}
                disabled={!canEdit || busy}
                invalid={Boolean(errors.tax_authority_code)}
                placeholder={t('taxInfo.chooseAuthority')}
                searchPlaceholder={t('taxInfo.search')}
                empty={t('taxInfo.searchEmpty')}
                onValueChange={(code) => set('tax_authority_code', code)}
              />
            )}
          </TopologyField>
          <TopologyField
            label={t('taxInfo.field_industry_code')}
            hint={catalog.industries.verified ? undefined : t('taxInfo.catalogUnverified')}
            error={errors.industry_code?.message}
          >
            {(id, describedBy) => (
              <CatalogCombobox
                id={id}
                describedBy={describedBy}
                value={values.industry_code}
                options={catalog.industries.items}
                disabled={!canEdit || busy}
                invalid={Boolean(errors.industry_code)}
                placeholder={t('taxInfo.chooseIndustry')}
                searchPlaceholder={t('taxInfo.search')}
                empty={t('taxInfo.searchEmpty')}
                onValueChange={(code) => set('industry_code', code)}
              />
            )}
          </TopologyField>
        </ModelCard>

        <ModelCard title={t('taxInfo.locations')} id="tax-info-locations" icon={<MapPin />}>
          <p className="text-sm text-muted-foreground">{t('taxInfo.locationsHint')}</p>
          {record.locations.length === 0 ? (
            <p className="text-sm">{t('taxInfo.noBranches')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label={t('taxInfo.locations')}>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t('taxInfo.locationCode')}</th>
                    <th className="py-2 pr-3 font-medium">{t('taxInfo.branchName')}</th>
                    <th className="py-2 pr-3 font-medium">{t('taxInfo.branchAddress')}</th>
                    <th className="py-2 font-medium">{t('taxInfo.headOffice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {record.locations.map((location, index) => {
                    const row = values.locations[index]
                    if (!row) return null
                    return (
                      <tr key={location.branch_id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Input
                            aria-label={t('taxInfo.locationCodeFor', { name: location.name })}
                            className="w-36"
                            maxLength={20}
                            disabled={!canEdit || busy}
                            value={row.tax_location_code}
                            onChange={(event) =>
                              set(`locations.${index}.tax_location_code`, event.target.value)
                            }
                          />
                        </td>
                        <td className="py-2 pr-3">
                          {location.name}
                          {location.status !== 'active' ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {t('taxInfo.branchDisabled')}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {location.address ?? t('storeInfo.addressEmpty')}
                        </td>
                        <td className="py-2">
                          <input
                            type="radio"
                            name="tax-head-office"
                            className="size-4"
                            aria-label={t('taxInfo.headOfficeFor', { name: location.name })}
                            checked={row.tax_head_office}
                            disabled={!canEdit || busy}
                            onChange={() => {
                              values.locations.forEach((_, other) => {
                                set(`locations.${other}.tax_head_office`, other === index)
                              })
                            }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {errors.locations?.message ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.locations.message}
            </p>
          ) : null}
        </ModelCard>

        <ModelCard title={t('taxInfo.signers')} id="tax-info-signers" icon={<PenLine />}>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('signer_name')}
            {text('preparer_name')}
            {text('storekeeper_name')}
            {text('cashier_name')}
          </div>
        </ModelCard>

        {write ? (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-background p-3">
            <div className="min-w-0 flex-1">
              <ModelNotice notice={notice} />
              {errors.root?.message ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.root.message}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || busy}
              onClick={() => {
                form.reset()
                onNotice(null)
              }}
            >
              {t('taxInfo.revert')}
            </Button>
            <Button type="submit" disabled={!canEdit || !dirty || busy}>
              {busy ? t('waiting') : t('taxInfo.save')}
            </Button>
          </div>
        ) : null}
      </form>
      {addressOpen ? (
        <AddressDialog
          provinceCode={values.province_code}
          wardCode={values.ward_code}
          street={values.street}
          onClose={() => setAddressOpen(false)}
          onPick={(picked) => {
            set('province_code', picked.provinceCode)
            set('ward_code', picked.wardCode)
            set('street', picked.street)
            set('province_name', picked.provinceName)
            set('ward_name', picked.wardName)
            setAddressOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
