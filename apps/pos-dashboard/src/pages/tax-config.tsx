import { conflictReason, describeFailure } from '@parkviet/pos-shared/request-failure'
import { mapSpreeErrorsToForm } from '@spree/dashboard-core'
import { Button, useDebouncedValue } from '@spree/dashboard-ui'
import { useQueryClient } from '@tanstack/react-query'
import { Percent, Receipt, Scale, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import {
  ModelCard,
  ModelCheck,
  ModelNotice,
  ModelPage,
  ModelState,
} from '../components/setup/model-ui'
import { TaxConfigConfirm } from '../components/tax-config-confirm'
import {
  RevenueYearBar,
  TaxPreviewCard,
  TaxReadinessCard,
  TaxRegimeFooter,
  TaxUsageCard,
} from '../components/tax-config-panels'
import { TaxOptionSelect } from '../components/tax-option-select'
import { ToggleRow } from '../components/toggle-row'
import { TopologyField, TopologySelect } from '../components/topology-fields'
import { usePosContext } from '../hooks/use-pos-context'
import { useSession } from '../hooks/use-session'
import {
  saveTaxRegime,
  TAX_METHODS,
  type TaxMethod,
  type TaxRegimeState,
  useTaxPreview,
  useTaxRegime,
} from '../hooks/use-tax-regime'
import { posKey } from '../lib/query-keys'
import {
  type OPTION_FIELDS,
  percentOf,
  type RegimeChange,
  regimeBody,
  regimeChange,
  regimeValues,
  revenueGroup,
  sameValues,
  type TaxRegimeField,
  type TaxRegimeValues,
  validateTaxRegime,
  withMethod,
  withRevenueGroup,
} from '../schemas/tax-regime'

type Notice = { text: string; failed: boolean } | null

export function TaxConfigPage() {
  const { t } = useTranslation()
  const context = usePosContext()
  const storeId = context.data?.store.id ?? null
  const write = context.data?.administration?.write === true
  const regime = useTaxRegime(storeId, Boolean(storeId) && write)
  const queryClient = useQueryClient()
  const session = useSession()
  const [notice, setNotice] = useState<Notice>(null)
  // The form remounts on its saved state only; a background refetch keeps the draft.
  const [saves, setSaves] = useState(0)
  return (
    <ModelPage title={t('taxConfig.title')}>
      {context.isPending || (write && regime.isPending) ? (
        <PageSkeleton />
      ) : context.isError || (write && (regime.isError || !regime.data)) ? (
        <ModelState error title={t('taxConfig.loadError')} retry={() => void regime.refetch()} />
      ) : !write || !regime.data ? (
        <ModelState title={t('taxConfig.needsWrite')} />
      ) : (
        <TaxConfigForm
          key={saves}
          state={regime.data}
          storeId={storeId}
          timeZone={context.data?.store.timezone ?? 'Asia/Ho_Chi_Minh'}
          notice={notice}
          onNotice={setNotice}
          onSaved={(saved) => {
            queryClient.setQueryData(posKey(session.storeId, 'tax-regime', storeId), saved)
            void queryClient.invalidateQueries({
              queryKey: posKey(session.storeId, 'tax-regime-preview'),
            })
            void queryClient.invalidateQueries({ queryKey: posKey(session.storeId, 'tax-options') })
            setSaves((count) => count + 1)
            setNotice({ text: t('taxConfig.saved'), failed: false })
          }}
        />
      )}
    </ModelPage>
  )
}

function TaxConfigForm({
  state,
  storeId,
  timeZone,
  notice,
  onNotice,
  onSaved,
}: {
  state: TaxRegimeState
  storeId: string | null
  timeZone: string
  notice: Notice
  onNotice: (notice: Notice) => void
  onSaved: (saved: TaxRegimeState) => void
}) {
  const { t, i18n } = useTranslation()
  const initial = useMemo(() => regimeValues(state), [state])
  const form = useForm<TaxRegimeValues>({ defaultValues: initial })
  const values = form.watch()
  const errors = form.formState.errors
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<RegimeChange | null>(null)
  const changed = state.regime === null || !sameValues(values, initial)
  const change = regimeChange(values, state)
  const group = revenueGroup(state, values.revenue_group)
  const direct = values.method === 'direct'

  const apply = (next: TaxRegimeValues) => {
    for (const key of Object.keys(next) as TaxRegimeField[])
      form.setValue(key, next[key] as never, { shouldDirty: true })
    form.clearErrors()
  }
  const set = <K extends TaxRegimeField>(key: K, value: TaxRegimeValues[K]) => {
    form.setValue(key, value as never, { shouldDirty: true })
    form.clearErrors(key)
  }

  // The preview follows the draft once it settles and only when the draft is valid.
  const draft = useDebouncedValue(JSON.stringify(values), 300)
  const body = useMemo(() => regimeBody(JSON.parse(draft) as TaxRegimeValues), [draft])
  const draftValid = Object.keys(validateTaxRegime(values, state)).length === 0
  const preview = useTaxPreview(storeId, body, draftValid)

  async function save(applyToAll: boolean) {
    setSaving(true)
    onNotice(null)
    try {
      onSaved(await saveTaxRegime(regimeBody(values), applyToAll))
    } catch (failure) {
      setPending(null)
      const reason = conflictReason(failure)
      if (reason === 'parameter_invalid' || !mapSpreeErrorsToForm(failure, form.setError))
        onNotice({ text: describeFailure(failure, t), failed: true })
    } finally {
      setSaving(false)
    }
  }

  function submit() {
    form.clearErrors()
    onNotice(null)
    const issues = validateTaxRegime(values, state)
    const fields = Object.keys(issues) as TaxRegimeField[]
    if (fields.length > 0) {
      for (const field of fields) form.setError(field, { message: t(issues[field] ?? '') })
      return
    }
    if (change.methodChanged || change.defaultsChanged) setPending(change)
    else void save(false)
  }

  const optionSelect = (
    field: (typeof OPTION_FIELDS)[number],
    label: string,
    method: TaxMethod,
  ) => (
    <TaxOptionSelect
      label={label}
      value={values[field]}
      options={state.available_options[method]}
      disabled={saving}
      error={errors[field]?.message}
      onChange={(value) => set(field, value)}
    />
  )
  const methodCard = (method: TaxMethod) => {
    const allowed = group?.methods.includes(method) ?? false
    const selected = values.method === method
    return (
      <label
        key={method}
        className={`rounded-md border p-3 transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 ${
          selected ? 'border-primary bg-primary/5' : 'cursor-pointer hover:bg-muted/50'
        }`}
      >
        <input
          type="radio"
          name="tax-method"
          className="sr-only"
          checked={selected}
          disabled={!allowed || saving}
          onChange={() => apply(withMethod(values, method, state))}
        />
        <span className="block font-medium">{t(`taxConfig.method_${method}`)}</span>
        <span className="block text-sm text-muted-foreground">
          {t(`taxConfig.method_${method}_hint`)}
        </span>
      </label>
    )
  }

  const pitIncomeRate = percentOf(group?.pit_income_rate ?? null)
  const formNode = (
    <form
      className="space-y-6 pb-4"
      aria-busy={saving}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <p className="text-sm text-muted-foreground">{t('taxConfig.intro')}</p>
      <ModelCard title={t('taxConfig.setup')} id="tax-config-setup" icon={<Settings2 />}>
        <ToggleRow
          checked={values.enabled}
          disabled={saving}
          switchLabel={t('taxConfig.enabled')}
          label={t('taxConfig.enabled')}
          description={t('taxConfig.enabledHint')}
          onChange={(value) => set('enabled', value)}
        />
      </ModelCard>

      {values.enabled ? (
        <>
          <ModelCard title={t('taxConfig.group')} id="tax-config-group" icon={<Scale />}>
            <TopologyField
              label={t('taxConfig.groupField')}
              hint={t('taxConfig.groupHint')}
              error={errors.revenue_group?.message}
            >
              {(id, describedBy) => (
                <TopologySelect
                  id={id}
                  describedBy={describedBy}
                  value={values.revenue_group}
                  disabled={saving}
                  invalid={Boolean(errors.revenue_group)}
                  options={state.revenue_groups.map((item) => ({
                    value: item.code,
                    label: t(`taxConfig.groupName_${item.code}`),
                  }))}
                  onChange={(value) =>
                    apply(
                      withRevenueGroup(values, value as TaxRegimeValues['revenue_group'], state),
                    )
                  }
                />
              )}
            </TopologyField>
          </ModelCard>

          <ModelCard title={t('taxConfig.method')} id="tax-config-method" icon={<Percent />}>
            <div
              role="radiogroup"
              aria-label={t('taxConfig.method')}
              className="grid gap-3 sm:grid-cols-2"
            >
              {TAX_METHODS.map(methodCard)}
            </div>
            {errors.method?.message ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.method.message}
              </p>
            ) : null}
          </ModelCard>

          <ModelCard
            title={direct ? t('taxConfig.detailsDirect') : t('taxConfig.detailsDeduction')}
            id="tax-config-details"
            icon={<Receipt />}
          >
            {direct ? (
              <>
                <RevenueYearBar year={state.revenue_year} />
                <ModelCheck
                  checked={values.threshold_warning}
                  disabled={saving}
                  onChange={(value) => set('threshold_warning', value)}
                  description={t('taxConfig.thresholdWarningHint')}
                >
                  {t('taxConfig.thresholdWarning')}
                </ModelCheck>
                {optionSelect('item_option', t('taxConfig.itemOption'), 'direct')}
                {optionSelect('service_fee_option', t('taxConfig.serviceFeeOption'), 'direct')}
                {optionSelect('shipping_option', t('taxConfig.shippingOption'), 'direct')}
                {group && group.pit_methods.length > 1 ? (
                  <TopologyField
                    label={t('taxConfig.pitMethod')}
                    error={errors.pit_method?.message}
                  >
                    {(id) => (
                      <TopologySelect
                        id={id}
                        value={values.pit_method}
                        disabled={saving}
                        invalid={Boolean(errors.pit_method)}
                        options={group.pit_methods.map((item) => ({
                          value: item,
                          label: t(`taxConfig.pit_${item}`),
                        }))}
                        onChange={(value) =>
                          set('pit_method', value as TaxRegimeValues['pit_method'])
                        }
                      />
                    )}
                  </TopologyField>
                ) : null}
                {values.pit_method === 'income' && pitIncomeRate ? (
                  <p className="text-sm" data-testid="tax-pit-income-rate">
                    {t('taxConfig.pitIncomeRate', { rate: pitIncomeRate })}
                  </p>
                ) : null}
                <ModelCheck
                  checked={values.apply_reduction}
                  disabled={saving}
                  onChange={(value) => set('apply_reduction', value)}
                  description={t('taxConfig.applyReductionHint')}
                >
                  {t('taxConfig.applyReduction')}
                </ModelCheck>
              </>
            ) : (
              <>
                {optionSelect('item_option', t('taxConfig.vatOption'), 'deduction')}
                <TopologyField label={t('taxConfig.priceMode')}>
                  {(id) => (
                    <TopologySelect
                      id={id}
                      value={values.prices_include_tax ? 'included' : 'excluded'}
                      disabled={saving}
                      options={[
                        { value: 'included', label: t('taxConfig.priceIncluded') },
                        { value: 'excluded', label: t('taxConfig.priceExcluded') },
                      ]}
                      onChange={(value) => set('prices_include_tax', value === 'included')}
                    />
                  )}
                </TopologyField>
                {change.pricesBecomeExclusive ? (
                  <p
                    role="status"
                    className="rounded-md border border-destructive/40 p-3 text-sm"
                    data-testid="tax-price-warning"
                  >
                    {t('taxConfig.priceExcludedWarning')}
                  </p>
                ) : null}
                {optionSelect('service_fee_option', t('taxConfig.serviceFeeVat'), 'deduction')}
                {optionSelect('shipping_option', t('taxConfig.shippingVat'), 'deduction')}
              </>
            )}
            <p className="text-sm text-muted-foreground">{t('taxConfig.defaultsNote')}</p>
          </ModelCard>
        </>
      ) : null}

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
          disabled={!changed || saving}
          onClick={() => {
            form.reset(initial)
            onNotice(null)
          }}
        >
          {t('taxConfig.revert')}
        </Button>
        <Button type="submit" disabled={!changed || saving}>
          {saving ? t('waiting') : t('taxConfig.save')}
        </Button>
      </div>
    </form>
  )

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {formNode}
        <aside className="space-y-6">
          <TaxPreviewCard
            preview={preview.data}
            failed={!draftValid || preview.isError}
            loading={preview.isFetching}
          />
          <TaxUsageCard storeId={storeId} />
          <TaxReadinessCard readiness={state.readiness} storeId={storeId} />
          <TaxRegimeFooter
            regime={state.regime}
            history={state.history}
            locale={i18n.language}
            timeZone={timeZone}
          />
        </aside>
      </div>
      {pending ? (
        <TaxConfigConfirm
          change={pending}
          productCount={state.product_count}
          openOrders={state.open_orders}
          busy={saving}
          onCancel={() => setPending(null)}
          onConfirm={(applyToAll) => void save(applyToAll)}
        />
      ) : null}
    </>
  )
}
