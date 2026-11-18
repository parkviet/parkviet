import { describeFailure } from '@parkviet/pos-shared/request-failure'
import type { Product } from '@spree/admin-sdk'
import { mapSpreeErrorsToForm, PageHeader, usePermissions } from '@spree/dashboard-core'
import { Badge, Button, Checkbox, Field, FieldLabel, Switch, Textarea } from '@spree/dashboard-ui'
import {
  BanknoteIcon,
  BoxesIcon,
  FolderTreeIcon,
  PackageIcon,
  StoreIcon,
} from '@spree/dashboard-ui/icons'
import { Link, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { CategoryChecklist } from '../components/goods-category-checklist'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelCard, ModelState } from '../components/setup/model-ui'
import { Input, TopologyField, TopologySelect } from '../components/topology-fields'
import {
  useGoodsProduct,
  useGoodsProductTypes,
  useGoodsTaxCategories,
  useGoodsWrite,
  usePosChannel,
} from '../hooks/use-goods'
import {
  createUnit,
  type FollowUpFailure,
  PRODUCT_FORM_EXPAND,
  type SaveContext,
  saveGoodsProduct,
  useGoodsTaxRates,
  useGoodsUnits,
  useProductBranches,
  useProductUnit,
} from '../hooks/use-goods-products'
import { GoodsSetupError, useGoodsSetup } from '../hooks/use-goods-setup'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  emptyGoodsProduct,
  formFromProduct,
  type GoodsKind,
  type GoodsProductFormValues,
  imageProblem,
  optionVariants,
  type ParsedGoodsProduct,
  PREP_PRESETS,
  sellingVariants,
} from '../lib/goods-products'
import { canAdminister, canWriteGoods } from '../lib/pos-access'
import { goodsProductSchema } from '../schemas/goods-product'

type Notice = { text: string; failed: boolean; lines?: string[] }
// What a create left to finish, shown once on the product's page it opens.
const afterCreate = new Map<string, Notice>()

const followUpNotice = (
  failures: FollowUpFailure[],
  t: (key: string, options?: Record<string, unknown>) => string,
  created: boolean,
): Notice =>
  failures.length === 0
    ? { text: t(created ? 'goods.products.form.created' : 'saved'), failed: false }
    : {
        text: t('goods.products.form.followUpFailed'),
        failed: true,
        lines: failures.map(
          ({ step, error }) =>
            `${t(`goods.products.form.followUp.${step}`)}: ${describeFailure(error, t)}`,
        ),
      }

// A full page for one product: creating at `/goods/products/new`, editing at
// `/goods/products/$productId`.
export function GoodsProductFormPage({ productId }: { productId?: string }) {
  const { t } = useTranslation()
  const { context } = usePosSession()
  const editing = productId !== undefined
  const product = useGoodsProduct(productId ?? '', PRODUCT_FORM_EXPAND, editing)
  const types = useGoodsProductTypes()
  const branches = useMemo(
    () => (context.data?.branches ?? []).filter((branch) => branch.status === 'active'),
    [context.data],
  )
  const access = { permissionKeys: usePermissions().permissionKeys, context: context.data }
  const manageBranches = canAdminister(access, true)
  const branchIds = useMemo(() => branches.map((branch) => branch.id), [branches])
  const assigned = useProductBranches(productId ?? '', branchIds, editing && branchIds.length > 0)
  const unit = useProductUnit(editing ? (product.data?.default_variant_id ?? null) : null)
  const [notice, setNotice] = useState<Notice | null>(() =>
    productId ? (afterCreate.get(productId) ?? null) : null,
  )
  useEffect(() => {
    if (productId) afterCreate.delete(productId)
  }, [productId])

  const loading =
    context.isPending ||
    types.isPending ||
    (editing &&
      (product.isPending || unit.isPending || (branchIds.length > 0 && assigned.isPending)))
  if (loading) return <PageSkeleton variant="page" />
  const failed = editing && (product.isError || assigned.isError)
  if (failed || types.isError)
    return (
      <div className="space-y-6">
        <PageHeader title={t('goods.products.title')} />
        <ModelState
          title={describeFailure(product.error ?? assigned.error ?? types.error, t)}
          error
          retry={() => {
            void product.refetch()
            void assigned.refetch()
            void types.refetch()
          }}
        />
      </div>
    )
  const existing = editing ? product.data : undefined
  const kind: GoodsKind =
    existing && existing.product_type_id === types.data?.byKind.service?.id ? 'service' : 'goods'
  const initial = existing
    ? formFromProduct(existing, {
        kind,
        unitCode: unit.data?.sale_unit ?? 'item',
        branchIds: assigned.data ?? [],
      })
    : emptyGoodsProduct(manageBranches ? branchIds : [])
  return (
    <ProductForm
      // A saved edit reloads the product; the form starts again from it.
      key={existing?.updated_at ?? 'new'}
      initial={initial}
      existing={
        existing
          ? {
              product: existing,
              branchIds: assigned.data ?? [],
              unitCode: unit.data?.sale_unit ?? 'item',
            }
          : undefined
      }
      branches={branches}
      manageBranches={manageBranches}
      notice={notice}
      setNotice={setNotice}
    />
  )
}

type Branch = { id: string; name: string; stock_location_id: string }

function ProductForm({
  initial,
  existing,
  branches,
  manageBranches,
  notice,
  setNotice,
}: {
  initial: GoodsProductFormValues
  existing?: { product: Product; branchIds: string[]; unitCode: string }
  branches: Branch[]
  manageBranches: boolean
  notice: Notice | null
  setNotice: (notice: Notice | null) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const { permissionKeys } = usePermissions()
  const canWrite = canWriteGoods({ permissionKeys })
  const currency = context.data?.store.currency ?? 'VND'
  const setup = useGoodsSetup()
  const channel = usePosChannel()
  const units = useGoodsUnits()
  const taxCategories = useGoodsTaxCategories()
  const taxRates = useGoodsTaxRates()
  const form = useForm<GoodsProductFormValues>({ defaultValues: initial })
  const draft = form.watch()
  const errors = form.formState.errors
  const [image, setImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState('')
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview])
  const save = useGoodsWrite(
    ({ value, context: saving }: { value: ParsedGoodsProduct; context: SaveContext }) =>
      saveGoodsProduct(value, saving),
  )
  const busy = form.formState.isSubmitting
  const withOptions = existing ? optionVariants(existing.product).length > 0 : false
  const readOnly = !canWrite
  const set = <K extends keyof GoodsProductFormValues>(key: K, value: GoodsProductFormValues[K]) =>
    form.setValue(key, value as never, { shouldDirty: true })
  const stockLocations = Object.fromEntries(
    branches.map((branch) => [branch.id, branch.stock_location_id]),
  )

  async function submit(values: GoodsProductFormValues) {
    form.clearErrors()
    setNotice(null)
    const parsed = goodsProductSchema(currency).safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        form.setError(issue.path.join('.') as keyof GoodsProductFormValues, {
          message: t(issue.message),
        })
      return
    }
    try {
      const outcome = await save.mutateAsync({
        value: parsed.data,
        context: {
          currency,
          ensurePosChannel: setup.ensurePosChannel,
          ensureProductTypes: setup.ensureProductTypes,
          stockLocations,
          manageBranches,
          image,
          existing,
        },
      })
      const next = followUpNotice(outcome.failures, t, !existing)
      if (existing) {
        setNotice(next)
        setImage(null)
        return
      }
      afterCreate.set(outcome.productId, next)
      navigate({
        to: '/$storeId/goods/products/$productId',
        params: { storeId, productId: outcome.productId },
        replace: true,
      })
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
    key: 'name' | 'sku' | 'barcode' | 'price' | 'costPrice' | 'prepMinutes',
    options: { hint?: string; placeholder?: string; disabled?: boolean; numeric?: boolean } = {},
  ) => (
    <TopologyField
      label={t(`goods.products.form.${key}`)}
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
          disabled={options.disabled}
          value={draft[key]}
          onChange={(event) => set(key, event.target.value)}
        />
      )}
    </TopologyField>
  )
  const taxOptions = (taxCategories.data ?? []).map((category) => {
    const rates = (taxRates.data ?? [])
      .filter((rate) => rate.tax_category_id === category.id && rate.rate_percent)
      .map((rate) => `${rate.rate_percent}%`)
    return {
      value: category.id,
      label: rates.length ? `${category.name} (${[...new Set(rates)].join(', ')})` : category.name,
    }
  })
  const variants = existing ? sellingVariants(existing.product) : []
  const selectedBranches = branches.filter((branch) => draft.branchIds.includes(branch.id))

  return (
    <form
      // Errors set by hand (schema and server) would otherwise block the next submit.
      onSubmit={(event) => {
        form.clearErrors()
        void form.handleSubmit(submit)(event)
      }}
      aria-busy={busy}
      className="space-y-6 pb-4"
    >
      <PageHeader
        title={existing ? existing.product.name : t('goods.products.form.createTitle')}
        actions={readOnly ? <Badge variant="outline">{t('adminReadAccess')}</Badge> : undefined}
      />
      {channel.data?.active === false && (
        <p role="status" className="text-sm text-warning">
          {t('goods.setup.pos_channel_inactive')}
        </p>
      )}
      {notice && (
        <div
          role={notice.failed ? 'alert' : 'status'}
          className={notice.failed ? 'text-destructive' : 'text-success'}
        >
          <p>{notice.text}</p>
          {notice.lines && (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {notice.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <fieldset disabled={busy || readOnly} className="flex flex-col gap-6">
        <ModelCard
          title={t('goods.products.form.general')}
          id="goods-general"
          icon={<PackageIcon />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {text('name')}
            <TopologyField label={t('goods.products.form.kind')}>
              {(id) => (
                <TopologySelect
                  id={id}
                  value={draft.kind}
                  options={(['goods', 'service'] as const).map((value) => ({
                    value,
                    label: t(`goods.kind.${value}`),
                  }))}
                  onChange={(value) => set('kind', value as GoodsKind)}
                />
              )}
            </TopologyField>
            <UnitField
              value={draft.unitCode}
              onChange={(code) => set('unitCode', code)}
              units={units.data ?? []}
              canCreate={canAdminister({ permissionKeys }, true)}
              disabled={withOptions || busy || readOnly}
              error={errors.unitCode?.message}
              onCreated={() => void units.refetch()}
            />
            {text('sku', {
              placeholder: t('goods.products.form.skuPlaceholder'),
              disabled: withOptions,
            })}
            {text('barcode', { disabled: withOptions })}
            <ImageField
              current={existing?.product.thumbnail_url ?? null}
              preview={preview}
              error={imageError}
              onPick={(file) => {
                setImageError('')
                if (!file) return setImage(null)
                const problem = imageProblem(file)
                if (problem) {
                  setImage(null)
                  setImageError(t(`goods.products.form.image_${problem}`))
                  return
                }
                setImage(file)
              }}
            />
          </div>
          {withOptions && (
            <p className="text-sm text-muted-foreground">
              {t('goods.products.form.withOptions', {
                count: optionVariants(existing!.product).length,
              })}
            </p>
          )}
          <TopologyField
            label={t('goods.products.form.description')}
            error={errors.description?.message}
          >
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                maxLength={2000}
                value={draft.description}
                onChange={(event) => set('description', event.target.value)}
              />
            )}
          </TopologyField>
          <div className="space-y-2">
            {text('prepMinutes', { hint: t('goods.products.form.prepHint'), numeric: true })}
            <div className="flex flex-wrap gap-2">
              {PREP_PRESETS.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  size="sm"
                  variant={draft.prepMinutes === String(minutes) ? 'default' : 'outline'}
                  aria-pressed={draft.prepMinutes === String(minutes)}
                  onClick={() => set('prepMinutes', String(minutes))}
                >
                  {t('goods.products.form.minutes', { count: minutes })}
                </Button>
              ))}
            </div>
          </div>
        </ModelCard>

        <ModelCard
          title={t('goods.products.form.pricing')}
          id="goods-pricing"
          icon={<BanknoteIcon />}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {text('price', {
              hint: t('goods.products.form.priceHint', { currency }),
              numeric: true,
              disabled: withOptions,
            })}
            {text('costPrice', { numeric: true, disabled: withOptions })}
            <TopologyField label={t('goods.products.form.tax')}>
              {(id) => (
                <TopologySelect
                  id={id}
                  value={draft.taxCategoryId}
                  options={[
                    { value: '', label: t('goods.products.form.taxDefault') },
                    ...taxOptions,
                  ]}
                  onChange={(value) => set('taxCategoryId', value)}
                />
              )}
            </TopologyField>
          </div>
        </ModelCard>

        <ModelCard title={t('goods.products.form.stock')} id="goods-stock" icon={<BoxesIcon />}>
          <SwitchRow
            label={t('goods.products.form.trackInventory')}
            hint={t('goods.products.form.trackHint')}
            checked={draft.trackInventory}
            disabled={withOptions}
            onChange={(checked) => set('trackInventory', checked)}
          />
          {!draft.trackInventory ? (
            <p className="text-sm text-muted-foreground">
              {t('goods.products.form.untrackedHint')}
            </p>
          ) : existing ? (
            <div className="space-y-2">
              <ul className="space-y-1 text-sm">
                {branches.map((branch) => {
                  const onHand = variants
                    .flatMap((variant) => variant.stock_levels ?? [])
                    .filter((level) => level.stock_location_id === branch.stock_location_id)
                    .reduce((sum, level) => sum + level.count_on_hand, 0)
                  return (
                    <li key={branch.id} className="flex justify-between gap-4">
                      <span>{branch.name}</span>
                      <span
                        className={
                          onHand < 0 ? 'font-medium text-destructive tabular-nums' : 'tabular-nums'
                        }
                      >
                        {onHand}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-sm text-muted-foreground">
                {t('goods.products.form.stockReadOnly')}{' '}
                <Link to="/$storeId/inventory" params={{ storeId }} className="underline">
                  {t('goods.products.form.openInventory')}
                </Link>
              </p>
            </div>
          ) : selectedBranches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('goods.products.form.stockNoBranch')}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedBranches.map((branch) => {
                const key = `openingStock.${branch.id}` as const
                const message = (
                  errors.openingStock as Record<string, { message?: string }> | undefined
                )?.[branch.id]?.message
                return (
                  <TopologyField
                    key={branch.id}
                    label={t('goods.products.form.openingStock', { branch: branch.name })}
                    error={message}
                  >
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="numeric"
                        aria-invalid={Boolean(message)}
                        value={draft.openingStock[branch.id] ?? ''}
                        onChange={(event) =>
                          form.setValue(key as never, event.target.value as never, {
                            shouldDirty: true,
                          })
                        }
                      />
                    )}
                  </TopologyField>
                )
              })}
            </div>
          )}
        </ModelCard>

        <ModelCard
          title={t('goods.products.form.categories')}
          id="goods-categories"
          icon={<FolderTreeIcon />}
        >
          <CategoryChecklist
            value={draft.categoryIds}
            onChange={(ids) => set('categoryIds', ids)}
            allowCreate={canWrite}
            disabled={busy || readOnly}
          />
        </ModelCard>

        <ModelCard
          title={t('goods.products.form.branches')}
          id="goods-branches"
          icon={<StoreIcon />}
        >
          {!manageBranches ? (
            <p className="text-sm text-muted-foreground">
              {t('goods.products.form.branchesReadOnly')}
            </p>
          ) : branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('goods.products.form.noBranches')}</p>
          ) : (
            <BranchChecklist
              branches={branches}
              value={draft.branchIds}
              onChange={(ids) => set('branchIds', ids)}
            />
          )}
        </ModelCard>
      </fieldset>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-md border bg-background p-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => navigate({ to: '/$storeId/goods/products', params: { storeId } })}
        >
          {t('adminCancel')}
        </Button>
        {!readOnly && (
          <Button
            type="submit"
            disabled={busy || (Boolean(existing) && !form.formState.isDirty && !image)}
          >
            {t(busy ? 'waiting' : 'save')}
          </Button>
        )}
      </div>
    </form>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}

function BranchChecklist({
  branches,
  value,
  onChange,
}: {
  branches: Branch[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <fieldset className="space-y-2" aria-label={t('goods.products.form.branches')}>
      {branches.map((branch) => (
        <Field key={branch.id} orientation="horizontal">
          <Checkbox
            id={`${id}-${branch.id}`}
            checked={value.includes(branch.id)}
            onCheckedChange={(checked) =>
              onChange(
                checked === true
                  ? [...value.filter((item) => item !== branch.id), branch.id]
                  : value.filter((item) => item !== branch.id),
              )
            }
          />
          <FieldLabel htmlFor={`${id}-${branch.id}`} className="font-normal">
            {branch.name}
          </FieldLabel>
        </Field>
      ))}
    </fieldset>
  )
}

function ImageField({
  current,
  preview,
  error,
  onPick,
}: {
  current: string | null
  preview: string | null
  error: string
  onPick: (file: File | null) => void
}) {
  const { t } = useTranslation()
  const shown = preview ?? current
  return (
    <TopologyField
      label={t('goods.products.form.image')}
      hint={t('goods.products.form.imageHint')}
      error={error}
    >
      {(id, describedBy) => (
        <div className="flex items-center gap-3">
          {shown && (
            <img src={shown} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
          )}
          <Input
            id={id}
            type="file"
            accept="image/png,image/jpeg"
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          />
        </div>
      )}
    </TopologyField>
  )
}

const UNIT_CODE = /^[a-z][a-z0-9_]{0,15}$/
function UnitField({
  value,
  onChange,
  units,
  canCreate,
  disabled,
  error,
  onCreated,
}: {
  value: string
  onChange: (code: string) => void
  units: { code: string; name: string }[]
  canCreate: boolean
  disabled: boolean
  error?: string
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState('')
  const create = useGoodsWrite(createUnit)
  const options = units.some((unit) => unit.code === value)
    ? units
    : [{ code: value, name: value }, ...units]
  async function add() {
    setProblem('')
    if (!name.trim() || !UNIT_CODE.test(code.trim())) {
      setProblem(t('goods.products.form.errors.newUnit'))
      return
    }
    try {
      const { data } = await create.mutateAsync({
        code: code.trim(),
        name: name.trim(),
        dimension: 'count',
      })
      onCreated()
      onChange(data.code)
      setAdding(false)
      setName('')
      setCode('')
    } catch (failure) {
      setProblem(describeFailure(failure, t))
    }
  }
  const control: ReactNode = (
    <TopologyField label={t('goods.products.form.unit')} error={error}>
      {(id) => (
        <TopologySelect
          id={id}
          value={value}
          disabled={disabled}
          options={options.map((unit) => ({
            value: unit.code,
            label: `${unit.name} (${unit.code})`,
          }))}
          onChange={onChange}
        />
      )}
    </TopologyField>
  )
  if (!canCreate) return control
  return (
    <div className="space-y-2">
      {control}
      {adding ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <TopologyField label={t('goods.products.form.newUnitName')}>
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  maxLength={64}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </TopologyField>
            <TopologyField label={t('goods.products.form.newUnitCode')} hint={t('units.codeHint')}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={code}
                  maxLength={16}
                  onChange={(event) => setCode(event.target.value)}
                />
              )}
            </TopologyField>
          </div>
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={create.isPending} onClick={() => void add()}>
              {t('goods.products.form.addUnit')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
              {t('adminCancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => setAdding(true)}
        >
          {t('goods.products.form.newUnit')}
        </Button>
      )}
    </div>
  )
}
