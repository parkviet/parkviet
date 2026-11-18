import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { mapSpreeErrorsToForm } from '@spree/dashboard-core'
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@spree/dashboard-ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useGoodsWrite } from '../hooks/use-goods'
import {
  type IngredientSaveContext,
  type IngredientSaveOutcome,
  type StoredIngredient,
  saveIngredient,
} from '../hooks/use-goods-ingredients'
import type { StoreUnitOption } from '../hooks/use-goods-products'
import { GoodsSetupError } from '../hooks/use-goods-setup'
import {
  emptyIngredient,
  INGREDIENT_QUICK_UNITS,
  type IngredientFormValues,
  type ParsedIngredient,
} from '../lib/goods-ingredients'
import { goodsIngredientSchema } from '../schemas/goods-ingredient'
import { Input, TopologyField, TopologySelect } from './topology-fields'

type Notice = { text: string; failed: boolean; lines?: string[] }
export type IngredientEditor = {
  initial: IngredientFormValues
  // What is stored now; absent when the ingredient is new.
  existing?: StoredIngredient
}
// One opening count per selling location; branches sharing one are named together.
export type StockLocationField = { id: string; label: string }

// The drawer that creates or edits one ingredient. "Save and create another"
// starts a blank form after a create that went through completely; a create
// whose unit or threshold failed stays open as an edit of what was saved.
export function GoodsIngredientSheet({
  editor,
  units,
  locations,
  alertBranch,
  saveContext,
  onSaved,
  onClose,
}: {
  editor: IngredientEditor
  units: StoreUnitOption[]
  locations: StockLocationField[]
  // The selected branch, when its threshold may be set here.
  alertBranch: { id: string; name: string } | null
  saveContext: Omit<IngredientSaveContext, 'existing' | 'alertBranchId'>
  onSaved: (name: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [existing, setExisting] = useState(editor.existing)
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t(
              existing ? 'goods.ingredients.form.editTitle' : 'goods.ingredients.form.createTitle',
            )}
          </SheetTitle>
          <SheetDescription>{t('goods.ingredients.form.intro')}</SheetDescription>
        </SheetHeader>
        <IngredientForm
          key={formKey}
          initial={formKey === 0 ? editor.initial : emptyIngredient(defaultUnit(units))}
          existing={existing}
          units={units}
          locations={locations}
          alertBranch={alertBranch}
          saveContext={saveContext}
          notice={notice}
          setNotice={setNotice}
          onSaved={(outcome, name, again) => {
            onSaved(name)
            if (outcome.failures.length > 0) {
              setExisting(outcome.stored)
              return
            }
            if (again) {
              setExisting(undefined)
              setFormKey((key) => key + 1)
              setNotice({ text: t('goods.ingredients.form.createdNext', { name }), failed: false })
              return
            }
            onClose()
          }}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  )
}

// `g` when the store has it, else its first unit.
export const defaultUnit = (units: StoreUnitOption[]) =>
  units.find((unit) => unit.code === 'g')?.code ?? units[0]?.code ?? ''

function IngredientForm({
  initial,
  existing,
  units,
  locations,
  alertBranch,
  saveContext,
  notice,
  setNotice,
  onSaved,
  onCancel,
}: {
  initial: IngredientFormValues
  existing?: StoredIngredient
  units: StoreUnitOption[]
  locations: StockLocationField[]
  alertBranch: { id: string; name: string } | null
  saveContext: Omit<IngredientSaveContext, 'existing' | 'alertBranchId'>
  notice: Notice | null
  setNotice: (notice: Notice | null) => void
  onSaved: (outcome: IngredientSaveOutcome, name: string, again: boolean) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm<IngredientFormValues>({ defaultValues: initial })
  const draft = form.watch()
  const errors = form.formState.errors
  const busy = form.formState.isSubmitting
  const save = useGoodsWrite((value: ParsedIngredient) =>
    saveIngredient(value, {
      ...saveContext,
      alertBranchId: alertBranch?.id ?? null,
      existing,
    }),
  )
  const set = <K extends keyof IngredientFormValues>(key: K, value: IngredientFormValues[K]) =>
    form.setValue(key, value as never, { shouldDirty: true })
  const quick = INGREDIENT_QUICK_UNITS.flatMap((code) => {
    const unit = units.find((row) => row.code === code)
    return unit ? [unit] : []
  })
  // A stored unit no longer offered stays selectable as it is.
  const unitOptions = [
    ...(draft.unitCode && !units.some((unit) => unit.code === draft.unitCode)
      ? [{ value: draft.unitCode, label: draft.unitCode }]
      : []),
    ...units.map((unit) => ({ value: unit.code, label: `${unit.name} (${unit.code})` })),
  ]

  async function submit(values: IngredientFormValues, again: boolean) {
    form.clearErrors()
    setNotice(null)
    const parsed = goodsIngredientSchema(saveContext.currency).safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        form.setError(issue.path.join('.') as keyof IngredientFormValues, {
          message: t(issue.message),
        })
      return
    }
    try {
      const outcome = await save.mutateAsync(parsed.data)
      if (outcome.failures.length > 0)
        setNotice({
          text: t('goods.ingredients.form.followUpFailed'),
          failed: true,
          lines: outcome.failures.map(
            ({ step, error }) =>
              `${t(`goods.ingredients.form.followUp.${step}`)}: ${describeFailure(error, t)}`,
          ),
        })
      onSaved(outcome, parsed.data.name, again)
    } catch (failure) {
      if (failure instanceof GoodsSetupError) {
        setNotice({ text: t(`goods.setup.${failure.reason}`), failed: true })
        return
      }
      mapSpreeErrorsToForm(failure, form.setError)
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const text = (
    key: 'name' | 'sku' | 'costPrice' | 'alert',
    options: { hint?: string; placeholder?: string; numeric?: boolean; label?: string } = {},
  ) => (
    <TopologyField
      label={options.label ?? t(`goods.ingredients.form.${key}`)}
      hint={options.hint}
      error={errors[key]?.message}
    >
      {(id, describedBy) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={Boolean(errors[key])}
          inputMode={options.numeric ? 'numeric' : 'text'}
          placeholder={options.placeholder}
          value={draft[key]}
          onChange={(event) => set(key, event.target.value)}
        />
      )}
    </TopologyField>
  )
  const unitName = units.find((unit) => unit.code === draft.unitCode)?.code ?? draft.unitCode
  return (
    <form
      className="flex flex-1 flex-col"
      noValidate
      onSubmit={form.handleSubmit((values) => submit(values, false))}
    >
      <div className="space-y-4 px-4 pb-4">
        {notice && (
          <div
            role={notice.failed ? 'alert' : 'status'}
            className={notice.failed ? 'text-destructive' : 'text-muted-foreground'}
          >
            <p>{notice.text}</p>
            {notice.lines && (
              <ul className="list-disc pl-5 text-sm">
                {notice.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {text('name')}
        {text('sku', { placeholder: t('goods.ingredients.form.skuPlaceholder') })}
        <TopologyField
          label={t('goods.ingredients.form.unit')}
          hint={t('goods.ingredients.form.unitHint')}
          error={errors.unitCode?.message}
        >
          {(id, describedBy) => (
            <div className="space-y-2">
              {quick.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quick.map((unit) => (
                    <Button
                      key={unit.code}
                      type="button"
                      size="sm"
                      variant={draft.unitCode === unit.code ? 'default' : 'outline'}
                      aria-pressed={draft.unitCode === unit.code}
                      onClick={() => set('unitCode', unit.code)}
                    >
                      {unit.code}
                    </Button>
                  ))}
                </div>
              )}
              <TopologySelect
                id={id}
                describedBy={describedBy}
                invalid={Boolean(errors.unitCode)}
                value={draft.unitCode}
                options={unitOptions}
                onChange={(value) => set('unitCode', value)}
              />
            </div>
          )}
        </TopologyField>
        {text('costPrice', {
          numeric: true,
          label: t('goods.ingredients.form.costPrice', { unit: unitName || '—' }),
        })}
        {alertBranch &&
          text('alert', {
            numeric: true,
            hint: t('goods.ingredients.form.alertHint', { branch: alertBranch.name }),
          })}
        {!existing && locations.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              {t('goods.ingredients.form.openingStock')}
            </legend>
            {locations.map((location) => {
              const error = (
                errors.openingStock as Record<string, { message?: string }> | undefined
              )?.[location.id]?.message
              return (
                <TopologyField
                  key={location.id}
                  label={t('goods.ingredients.form.openingStockAt', {
                    location: location.label,
                    unit: unitName || '—',
                  })}
                  error={error}
                >
                  {(id, describedBy) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={Boolean(error)}
                      inputMode="numeric"
                      value={draft.openingStock[location.id] ?? ''}
                      onChange={(event) =>
                        set('openingStock', {
                          ...draft.openingStock,
                          [location.id]: event.target.value,
                        })
                      }
                    />
                  )}
                </TopologyField>
              )
            })}
          </fieldset>
        )}
      </div>
      <SheetFooter className="mt-auto">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          {t('adminCancel')}
        </Button>
        {!existing && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void form.handleSubmit((values) => submit(values, true))()}
          >
            {t('goods.ingredients.form.saveAndNew')}
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {t(busy ? 'waiting' : 'save')}
        </Button>
      </SheetFooter>
    </form>
  )
}
