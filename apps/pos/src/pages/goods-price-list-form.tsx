import { describeFailure } from '@shared/request-failure'
import { adminClient, PageHeader, usePermissions } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Checkbox,
  DialogBody,
  DialogFooter,
  Field,
  FieldLabel,
  Pagination,
  ProductIdentity,
  SearchInput,
  useConfirm,
  useDebouncedValue,
} from '@spree/dashboard-ui'
import { PackageIcon, TagsIcon } from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListPriceDialog } from '../components/goods-product-price-lists'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelCard, ModelState } from '../components/setup/model-ui'
import { TopologyDialog } from '../components/topology-dialog'
import { Input, TopologyField, TopologySelect } from '../components/topology-fields'
import { goodsKey, useGoodsWrite } from '../hooks/use-goods'
import { type PickedProduct, pickedProduct, useProductPicker } from '../hooks/use-goods-categories'
import {
  addListProducts,
  type ListProduct,
  removeFromPriceList,
  type SavedPriceList,
  type ScreenEntry,
  savePriceList,
  useCustomerGroups,
  useListPrices,
  useListProducts,
  usePriceListScreen,
  useSalesChannels,
  writeListPrices,
} from '../hooks/use-goods-price-lists'
import { POS_CHANNEL_CODE, POS_CHANNEL_NAME, useGoodsSetup } from '../hooks/use-goods-setup'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  type Formula,
  formulaUpserts,
  formulaValueValid,
  listChannels,
  newPriceListValues,
  nextListCode,
  type PriceListFormErrors,
  type PriceListFormValues,
  type PricingMethod,
  priceListPayload,
  priceListValues,
  validatePriceList,
  zonedDay,
} from '../lib/goods-price-list-form'
import { listPriceRows, listPriceSummary, volumeRule } from '../lib/goods-price-lists'
import { formatRange } from '../lib/goods-products'
import {
  canCreatePosChannel,
  canReadChannels,
  canReadCustomerGroups,
  canWriteGoods,
} from '../lib/pos-access'

// The `pos` channel before it exists: the save creates it (see use-goods-setup).
const POS_PLACEHOLDER = '__pos__'
type Notice = { text: string; failed: boolean } | null
// What a create left to say, shown once on the list's page it opens.
const afterCreate = new Map<string, string>()

export function GoodsPriceListFormPage({ priceListId }: { priceListId?: string }) {
  const { t } = useTranslation()
  const { context } = usePosSession()
  const { permissionKeys } = usePermissions()
  const access = { permissionKeys }
  const screen = usePriceListScreen()
  const channels = useSalesChannels(canReadChannels(access))
  const groups = useCustomerGroups(canReadCustomerGroups(access))
  const loading =
    screen.isPending || context.isPending || (canReadChannels(access) && channels.isPending)
  if (screen.isError)
    return (
      <div className="space-y-6">
        <PageHeader title={t('goods.priceLists.title')} />
        <ModelState
          title={describeFailure(screen.error, t)}
          error
          retry={() => void screen.refetch()}
        />
      </div>
    )
  if (loading) return <PageSkeleton variant="page" />
  const entry = priceListId
    ? (screen.data.find((row) => row.list.id === priceListId) ?? null)
    : null
  if (priceListId && !entry)
    return (
      <div className="space-y-6">
        <PageHeader title={t('goods.priceLists.title')} />
        <ModelState title={t('goods.priceLists.notFound')} error />
      </div>
    )
  return (
    <PriceListForm
      entry={entry}
      entries={screen.data}
      channels={channels.data ?? null}
      groups={groups.data ?? null}
      groupsFailed={groups.isError}
    />
  )
}

type ChannelOption = { id: string; name: string }

function PriceListForm({
  entry,
  entries,
  channels,
  groups,
  groupsFailed,
}: {
  entry: ScreenEntry | null
  entries: ScreenEntry[]
  channels: { id: string; name: string; code: string }[] | null
  groups: { id: string; name: string }[] | null
  groupsFailed: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const { permissionKeys } = usePermissions()
  const canWrite = canWriteGoods({ permissionKeys })
  const setup = useGoodsSetup()
  const timeZone = context.data?.store.timezone || 'Asia/Ho_Chi_Minh'
  const currency = context.data?.store.currency ?? 'VND'
  const posChannel = channels?.find((row) => row.code === POS_CHANNEL_CODE) ?? null
  const generated = useMemo(() => nextListCode(entries.map((row) => row.list)), [entries])
  const initial = useMemo<PriceListFormValues>(
    () =>
      entry
        ? priceListValues(entry.list, {
            timeZone,
            groupIds: entry.catalog ? entry.catalog.groupIds : null,
          })
        : newPriceListValues({
            code: '',
            today: zonedDay(new Date(), timeZone),
            posChannelId: posChannel?.id ?? POS_PLACEHOLDER,
          }),
    [entry, timeZone, posChannel],
  )
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<PriceListFormErrors>({})
  const [notice, setNotice] = useState<Notice>(() => {
    const text = entry ? afterCreate.get(entry.list.id) : undefined
    if (entry) afterCreate.delete(entry.list.id)
    return text ? { text, failed: false } : null
  })
  const saved = useRef<SavedPriceList | null>(
    entry ? { listId: entry.list.id, catalogId: entry.catalog?.id ?? null, activated: true } : null,
  )
  // Once a save has written the list, its audience is fixed: a retry finishes
  // that list rather than making one for the other audience.
  const [written, setWritten] = useState(Boolean(entry))
  const save = useGoodsWrite(savePriceList)
  const busy = save.isPending
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const set = <K extends keyof PriceListFormValues>(key: K, value: PriceListFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))
  const message = (key: keyof PriceListFormErrors) =>
    errors[key] ? t(`goods.priceLists.form.errors.${errors[key]}`) : undefined

  // Channels offered: the store's, or (when they cannot be read) the ones the
  // list already names and the `pos` channel.
  const channelOptions: ChannelOption[] = channels
    ? [
        ...channels.map((row) => ({ id: row.id, name: row.name })),
        ...(posChannel ? [] : [{ id: POS_PLACEHOLDER, name: POS_CHANNEL_NAME }]),
      ]
    : [
        ...(entry ? listChannels(entry.list) : []),
        ...(entry ? [] : [{ id: POS_PLACEHOLDER, name: POS_CHANNEL_NAME }]),
      ]

  async function resolveChannels(ids: string[]) {
    if (!ids.includes(POS_PLACEHOLDER)) return ids
    const channel = await setup.ensurePosChannel()
    return [...new Set(ids.map((item) => (item === POS_PLACEHOLDER ? channel.id : item)))]
  }

  async function submit() {
    setNotice(null)
    const found = validatePriceList(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const channelIds =
        values.audience === 'all' ? await resolveChannels(values.channelIds) : values.channelIds
      const payload = priceListPayload(
        { ...values, channelIds },
        { timeZone, existing: entry?.list, fallbackCode: generated },
      )
      const created = !entry
      const result = await save.mutateAsync({
        saved: saved.current,
        payload,
        groupIds: values.audience === 'groups' ? values.groupIds : null,
        progress: (next) => {
          saved.current = next
          setWritten(true)
        },
      })
      if (created) {
        afterCreate.set(result.listId, t('goods.priceLists.form.created', { name: payload.name }))
        await navigate({
          to: '/$storeId/goods/price-lists/$priceListId',
          params: { storeId, priceListId: result.listId },
        })
        return
      }
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
      if (saved.current) void client.invalidateQueries({ queryKey: goodsKey(storeId) })
    }
  }

  const choices = (
    label: string,
    name: string,
    current: string,
    options: { value: string; label: string; hint?: string }[],
    onChange: (value: string) => void,
    disabled?: boolean,
  ) => (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-w-48 flex-1 cursor-pointer items-start gap-2 rounded-md border p-3 has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name={`${id}-${name}`}
              value={option.value}
              checked={current === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{option.label}</span>
              {option.hint && (
                <span className="block text-sm text-muted-foreground">{option.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
  const checklist = (
    label: string,
    options: ChannelOption[],
    selected: string[],
    onChange: (ids: string[]) => void,
    error?: string,
  ) => (
    <fieldset className="space-y-2" aria-label={label}>
      <legend className="text-sm font-medium">{label}</legend>
      {options.map((option) => (
        <Field key={option.id} orientation="horizontal">
          <Checkbox
            id={`${id}-${option.id}`}
            checked={selected.includes(option.id)}
            onCheckedChange={(checked) =>
              onChange(
                checked === true
                  ? [...selected.filter((item) => item !== option.id), option.id]
                  : selected.filter((item) => item !== option.id),
              )
            }
          />
          <FieldLabel htmlFor={`${id}-${option.id}`} className="font-normal">
            {option.name}
          </FieldLabel>
        </Field>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )

  return (
    <div className="space-y-6 pb-4">
      <form
        className="space-y-6"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <PageHeader
          title={entry ? entry.list.name : t('goods.priceLists.form.createTitle')}
          actions={canWrite ? undefined : <Badge variant="outline">{t('adminReadAccess')}</Badge>}
        />
        {notice && (
          <p
            role={notice.failed ? 'alert' : 'status'}
            className={notice.failed ? 'text-destructive' : 'text-success'}
          >
            {notice.text}
          </p>
        )}
        <fieldset disabled={busy || !canWrite} className="flex flex-col gap-6">
          <ModelCard
            title={t('goods.priceLists.form.general')}
            id="price-list-general"
            icon={<TagsIcon />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TopologyField
                label={t('goods.priceLists.form.code')}
                hint={t('goods.priceLists.form.codeHint')}
                error={message('code')}
              >
                {(fieldId, describedBy) => (
                  <Input
                    id={fieldId}
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(errors.code)}
                    maxLength={32}
                    placeholder={entry ? undefined : generated}
                    value={values.code}
                    onChange={(event) => set('code', event.target.value)}
                  />
                )}
              </TopologyField>
              <TopologyField label={t('goods.priceLists.form.name')} error={message('name')}>
                {(fieldId) => (
                  <Input
                    id={fieldId}
                    aria-invalid={Boolean(errors.name)}
                    maxLength={120}
                    value={values.name}
                    onChange={(event) => set('name', event.target.value)}
                  />
                )}
              </TopologyField>
              <TopologyField
                label={t('goods.priceLists.form.startsOn')}
                hint={t('goods.priceLists.form.datesHint')}
                error={message('startsOn')}
              >
                {(fieldId, describedBy) => (
                  <Input
                    id={fieldId}
                    type="date"
                    aria-describedby={describedBy}
                    value={values.startsOn}
                    onChange={(event) => set('startsOn', event.target.value)}
                  />
                )}
              </TopologyField>
              <div className="space-y-2">
                <TopologyField label={t('goods.priceLists.form.endsOn')} error={message('endsOn')}>
                  {(fieldId) => (
                    <Input
                      id={fieldId}
                      type="date"
                      disabled={values.noEnd}
                      aria-invalid={Boolean(errors.endsOn)}
                      value={values.noEnd ? '' : values.endsOn}
                      onChange={(event) => set('endsOn', event.target.value)}
                    />
                  )}
                </TopologyField>
                <Field orientation="horizontal">
                  <Checkbox
                    id={`${id}-no-end`}
                    checked={values.noEnd}
                    onCheckedChange={(checked) => set('noEnd', checked === true)}
                  />
                  <FieldLabel htmlFor={`${id}-no-end`} className="font-normal">
                    {t('goods.priceLists.form.noEnd')}
                  </FieldLabel>
                </Field>
              </div>
            </div>
          </ModelCard>

          <ModelCard
            title={t('goods.priceLists.form.reach')}
            id="price-list-reach"
            icon={<PackageIcon />}
          >
            {choices(
              t('goods.priceLists.form.audience'),
              'audience',
              values.audience,
              [
                { value: 'all', label: t('goods.priceLists.form.audienceAll') },
                {
                  value: 'groups',
                  label: t('goods.priceLists.form.audienceGroups'),
                  hint: t('goods.priceLists.form.audienceGroupsHint'),
                },
              ],
              (value) => set('audience', value as PriceListFormValues['audience']),
              // A list keeps how it reaches buyers: a group list lives in its catalog.
              written || !canReadCustomerGroups({ permissionKeys }),
            )}
            {written && (
              <p className="text-sm text-muted-foreground">
                {t('goods.priceLists.form.audienceLocked')}
              </p>
            )}
            {values.audience === 'all' ? (
              <>
                {checklist(
                  t('goods.priceLists.form.channels'),
                  channelOptions,
                  values.channelIds,
                  (ids) => set('channelIds', ids),
                )}
                <p className="text-sm text-muted-foreground">
                  {t(
                    values.channelIds.length === 0
                      ? 'goods.priceLists.form.everyChannel'
                      : 'goods.priceLists.form.channelsHint',
                  )}
                </p>
                {!channels && (
                  <p className="text-sm text-muted-foreground">
                    {t('goods.priceLists.form.channelsUnreadable')}
                  </p>
                )}
                {values.channelIds.includes(POS_PLACEHOLDER) &&
                  !canCreatePosChannel({ permissionKeys }) &&
                  !channels && (
                    <p className="text-sm text-muted-foreground">
                      {t('goods.setup.pos_channel_forbidden')}
                    </p>
                  )}
              </>
            ) : groupsFailed || !groups ? (
              <p role="alert" className="text-sm text-destructive">
                {t('goods.priceLists.form.groupsUnreadable')}
              </p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('goods.priceLists.form.noGroups')}</p>
            ) : (
              checklist(
                t('goods.priceLists.form.groups'),
                groups.map((group) => ({ id: group.id, name: group.name })),
                values.groupIds,
                (ids) => set('groupIds', ids),
                message('groupIds'),
              )
            )}
          </ModelCard>

          <ModelCard
            title={t('goods.priceLists.form.pricing')}
            id="price-list-pricing"
            icon={<TagsIcon />}
          >
            {choices(
              t('goods.priceLists.form.method'),
              'method',
              values.method,
              (['fixed', 'formula', 'volume'] as const).map((value) => ({
                value,
                label: t(`goods.priceLists.method.${value}`),
                hint: t(`goods.priceLists.form.methodHint.${value}`),
              })),
              (value) => set('method', value as PricingMethod),
            )}
            {values.method === 'formula' && (
              <FormulaFields
                formula={values.formula}
                error={message('formula')}
                onChange={(formula) => set('formula', formula)}
              />
            )}
            {values.method === 'volume' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TopologyField
                  label={t('goods.priceLists.form.minQuantity')}
                  hint={t('goods.priceLists.form.minQuantityHint')}
                  error={message('minQuantity')}
                >
                  {(fieldId, describedBy) => (
                    <Input
                      id={fieldId}
                      inputMode="numeric"
                      aria-describedby={describedBy}
                      aria-invalid={Boolean(errors.minQuantity)}
                      value={values.minQuantity}
                      onChange={(event) => set('minQuantity', event.target.value)}
                    />
                  )}
                </TopologyField>
                <TopologyField
                  label={t('goods.priceLists.form.maxQuantity')}
                  hint={t('goods.priceLists.form.maxQuantityHint')}
                  error={message('maxQuantity')}
                >
                  {(fieldId, describedBy) => (
                    <Input
                      id={fieldId}
                      inputMode="numeric"
                      aria-describedby={describedBy}
                      aria-invalid={Boolean(errors.maxQuantity)}
                      value={values.maxQuantity}
                      onChange={(event) => set('maxQuantity', event.target.value)}
                    />
                  )}
                </TopologyField>
              </div>
            )}
          </ModelCard>
        </fieldset>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-md border bg-background p-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => navigate({ to: '/$storeId/goods/price-lists', params: { storeId } })}
          >
            {t(canWrite ? 'adminCancel' : 'adminClose')}
          </Button>
          {canWrite && (
            <Button type="submit" disabled={busy || (Boolean(entry) && !dirty)}>
              {t(busy ? 'waiting' : 'save')}
            </Button>
          )}
        </div>
      </form>

      <ModelCard
        title={t('goods.priceLists.products.title')}
        id="price-list-products"
        icon={<PackageIcon />}
      >
        {entry ? (
          <ListProducts
            entry={entry}
            currency={currency}
            canWrite={canWrite}
            formula={values.method === 'formula' ? values.formula : null}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('goods.priceLists.products.afterCreate')}
          </p>
        )}
      </ModelCard>
    </div>
  )
}

function FormulaFields({
  formula,
  error,
  onChange,
}: {
  formula: Formula
  error?: string
  onChange: (formula: Formula) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('goods.priceLists.form.formulaHint')}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <TopologyField label={t('goods.priceLists.form.direction')}>
          {(fieldId) => (
            <TopologySelect
              id={fieldId}
              value={formula.direction}
              options={(['decrease', 'increase'] as const).map((value) => ({
                value,
                label: t(`goods.priceLists.form.direction_${value}`),
              }))}
              onChange={(value) =>
                onChange({ ...formula, direction: value as Formula['direction'] })
              }
            />
          )}
        </TopologyField>
        <TopologyField label={t('goods.priceLists.form.formulaKind')}>
          {(fieldId) => (
            <TopologySelect
              id={fieldId}
              value={formula.kind}
              options={(['percent', 'amount'] as const).map((value) => ({
                value,
                label: t(`goods.priceLists.form.kind_${value}`),
              }))}
              onChange={(value) => onChange({ ...formula, kind: value as Formula['kind'] })}
            />
          )}
        </TopologyField>
        <TopologyField label={t('goods.priceLists.form.formulaValue')} error={error}>
          {(fieldId) => (
            <Input
              id={fieldId}
              inputMode="decimal"
              aria-invalid={Boolean(error)}
              value={formula.value}
              onChange={(event) => onChange({ ...formula, value: event.target.value })}
            />
          )}
        </TopologyField>
      </div>
    </div>
  )
}

// The products the list prices: each variant's selling price and the list's
// price (with its quantity breaks). Prices are written on their own.
function ListProducts({
  entry,
  currency,
  canWrite,
  formula,
}: {
  entry: ScreenEntry
  currency: string
  canWrite: boolean
  formula: Formula | null
}) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const listId = entry.list.id
  const products = useListProducts(listId)
  const prices = useListPrices(listId, currency)
  const write = useGoodsWrite(async (run: () => Promise<unknown>) => run())
  const [editing, setEditing] = useState<ListProduct | null>(null)
  const [picking, setPicking] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const usable = formula && formulaValueValid(formula) ? formula : null
  const rule = volumeRule(entry.list)

  async function act(run: () => Promise<unknown>, success: string) {
    setNotice(null)
    try {
      await write.mutateAsync(run)
      setNotice({ text: success, failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }
  async function remove(product: ListProduct) {
    if (
      !(await confirm({
        message: t('goods.priceLists.products.removeConfirm', { name: product.name }),
        variant: 'destructive',
        confirmLabel: t('goods.priceLists.products.remove'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () => removeFromPriceList({ listId, productId: product.id }),
      t('goods.priceLists.products.removed', { name: product.name }),
    )
  }
  async function applyFormula() {
    if (!usable) return
    if (
      !(await confirm({
        message: t('goods.priceLists.products.applyConfirm'),
        variant: 'destructive',
        confirmLabel: t('goods.priceLists.products.apply'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    const all = (products.data ?? []).flatMap((product) => product.variants)
    const upserts = formulaUpserts(all, prices.data ?? [], { formula: usable, listId, currency })
    await act(
      () => writeListPrices(upserts),
      t('goods.priceLists.products.applied', { count: upserts.length }),
    )
  }
  async function add(picked: PickedProduct[]) {
    const ids = picked.map((row) => row.id)
    await act(
      async () => {
        let upserts: ReturnType<typeof formulaUpserts> = []
        if (usable) {
          const page = await adminClient.products.list({
            limit: 100,
            id_in: ids,
            expand: ['variants'],
          })
          const variants = page.data.flatMap((product) =>
            (product.variants ?? []).map((variant) => ({
              id: variant.id,
              basePrice: variant.price?.amount ?? null,
            })),
          )
          upserts = formulaUpserts(variants, [], { formula: usable, listId, currency })
        }
        await addListProducts({ listId, productIds: ids, upserts })
      },
      t('goods.priceLists.products.added', { count: ids.length }),
    )
    setPicking(false)
  }

  const failure = products.error ?? prices.error
  if (failure)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{describeFailure(failure, t)}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void Promise.all([products.refetch(), prices.refetch()])}
        >
          {t('retry')}
        </Button>
      </div>
    )
  if (!products.data || !prices.data)
    return (
      <p role="status" className="text-sm">
        {t('waiting')}
      </p>
    )
  const rows = prices.data
  const members = products.data
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {rule
          ? t(
              rule.max
                ? 'goods.products.form.priceLists.volumeRange'
                : 'goods.products.form.priceLists.volumeFrom',
              { min: rule.min, max: rule.max },
            )
          : t('goods.priceLists.products.hint')}
      </p>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setPicking(true)}>
            {t('goods.priceLists.products.add')}
          </Button>
          {usable && members.length > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={write.isPending}
              onClick={() => void applyFormula()}
            >
              {t('goods.priceLists.products.apply')}
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={notice.failed ? 'text-sm text-destructive' : 'text-sm text-success'}
        >
          {notice.text}
        </p>
      )}
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('goods.priceLists.products.empty')}</p>
      ) : (
        <ul
          className="divide-y rounded-md border"
          aria-label={t('goods.priceLists.products.title')}
        >
          {members.map((product) => {
            const variantIds = product.variants.map((variant) => variant.id)
            const summary = listPriceSummary(listPriceRows(variantIds, rows, listId, currency))
            const base = product.variants
              .map((variant) => variant.basePrice)
              .filter((amount): amount is string => amount !== null)
              .sort((a, b) => Number(a) - Number(b))
            return (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <ProductIdentity
                    name={product.name}
                    subtitle={
                      product.variants.length > 1
                        ? t('goods.products.variantCount', { count: product.variants.length })
                        : product.variants[0]?.sku || undefined
                    }
                    thumbnailUrl={product.thumbnailUrl}
                    size="sm"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('goods.priceLists.products.base', {
                      amount: base.length
                        ? formatRange({ min: base[0], max: base[base.length - 1] }, currency)
                        : '—',
                    })}
                    {' · '}
                    {summary.min
                      ? t('goods.priceLists.products.listPrice', {
                          amount: formatRange(
                            { min: summary.min, max: summary.max ?? summary.min },
                            currency,
                          ),
                        })
                      : t('goods.priceLists.products.noListPrice')}
                    {summary.tiers > 0 &&
                      ` · ${t('goods.products.form.priceLists.tierCount', { count: summary.tiers })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={t('goods.priceLists.products.editFor', { name: product.name })}
                    onClick={() => setEditing(product)}
                  >
                    {t(
                      canWrite
                        ? 'goods.products.form.priceLists.edit'
                        : 'goods.products.form.priceLists.view',
                    )}
                  </Button>
                  {canWrite && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={write.isPending}
                      aria-label={t('goods.priceLists.products.removeFor', { name: product.name })}
                      onClick={() => void remove(product)}
                    >
                      {t('goods.priceLists.products.remove')}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editing && (
        <ListPriceDialog
          list={entry.list}
          join={false}
          productId={editing.id}
          variants={editing.variants.map((variant) => ({
            id: variant.id,
            label: variant.label,
            basePrice: variant.basePrice,
          }))}
          prices={rows}
          currency={currency}
          canWrite={canWrite}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setNotice({ text: t('saved'), failed: false })
          }}
        />
      )}
      {picking && (
        <ProductPicker
          exclude={new Set(members.map((product) => product.id))}
          busy={write.isPending}
          formula={Boolean(usable)}
          onPick={(picked) => void add(picked)}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

function ProductPicker({
  exclude,
  busy,
  formula,
  onPick,
  onClose,
}: {
  exclude: Set<string>
  busy: boolean
  formula: boolean
  onPick: (picked: PickedProduct[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const search = useDebouncedValue(term, 300)
  const products = useProductPicker(search, page)
  const [picked, setPicked] = useState<PickedProduct[]>([])
  const pickedIds = new Set(picked.map((row) => row.id))
  const pageRows = (products.data?.data ?? []).map(pickedProduct)
  const toggle = (product: PickedProduct, on: boolean) =>
    setPicked((rows) =>
      on
        ? [...rows.filter((row) => row.id !== product.id), product]
        : rows.filter((row) => row.id !== product.id),
    )
  let body: ReactNode
  if (products.isError)
    body = (
      <p role="alert" className="text-sm text-destructive">
        {describeFailure(products.error, t)}
      </p>
    )
  else if (pageRows.length === 0)
    body = (
      <p className="text-sm text-muted-foreground">
        {products.isPending ? t('waiting') : t('goods.categories.pickerEmpty')}
      </p>
    )
  else
    body = (
      <>
        <ul
          className="max-h-80 divide-y overflow-y-auto rounded-md border"
          aria-label={t('goods.priceLists.products.pickerList')}
        >
          {pageRows.map((product) => {
            const member = exclude.has(product.id)
            return (
              <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  id={`${id}-pick-${product.id}`}
                  aria-label={product.name}
                  checked={member || pickedIds.has(product.id)}
                  disabled={member}
                  onCheckedChange={(checked) => toggle(product, checked === true)}
                />
                <label htmlFor={`${id}-pick-${product.id}`} className="min-w-0 flex-1">
                  <ProductIdentity
                    name={product.name}
                    subtitle={
                      member ? t('goods.priceLists.products.member') : product.sku || undefined
                    }
                    thumbnailUrl={product.thumbnailUrl}
                    size="sm"
                  />
                </label>
              </li>
            )
          })}
        </ul>
        {products.data && products.data.meta.pages > 1 && (
          <Pagination meta={products.data.meta} onPageChange={setPage} />
        )}
      </>
    )

  return (
    <TopologyDialog
      title={t('goods.priceLists.products.add')}
      subtitle={formula ? t('goods.priceLists.products.addFormula') : undefined}
      dirty={picked.length > 0}
      busy={busy}
      onClose={onClose}
    >
      {(close) => (
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (picked.length > 0) onPick(picked)
          }}
        >
          <DialogBody className="space-y-3">
            <SearchInput
              value={term}
              onValueChange={(value) => {
                setTerm(value)
                setPage(1)
              }}
              placeholder={t('goods.categories.pickerSearch')}
              aria-label={t('goods.categories.pickerSearch')}
              clearLabel={t('goods.categories.clearSearch')}
              className="h-[2.125rem]"
            />
            {body}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={busy || picked.length === 0}>
              {t(busy ? 'waiting' : 'goods.priceLists.products.addCount', {
                count: picked.length,
              })}
            </Button>
          </DialogFooter>
        </form>
      )}
    </TopologyDialog>
  )
}
