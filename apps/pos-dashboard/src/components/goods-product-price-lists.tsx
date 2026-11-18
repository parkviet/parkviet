import { formatMoney } from '@parkviet/pos-shared/money'
import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { useResourceMutation } from '@spree/dashboard-core'
import { Badge, Button, DialogBody, DialogFooter, useConfirm } from '@spree/dashboard-ui'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { goodsKey } from '../hooks/use-goods'
import {
  removeFromPriceList,
  saveListPrices,
  useGoodsPriceLists,
  useProductListPrices,
} from '../hooks/use-goods-price-lists'
import { useSession } from '../hooks/use-session'
import {
  amountErrorKey,
  type ListPriceErrors,
  type ListPriceRow,
  listPriceChanges,
  listPriceRows,
  listPriceSummary,
  listsPricing,
  MAX_RUNGS,
  type PriceListSlice,
  tierErrorKey,
  volumeRule,
} from '../lib/goods-price-lists'
import { formatRange } from '../lib/goods-products'
import { parseAmount } from '../schemas/goods-product'
import { modelDate } from './setup/model-ui'
import { TopologyDialog } from './topology-dialog'
import { Input, TopologyField, TopologySelect } from './topology-fields'

type ProductVariant = { id: string; label: string; basePrice: string | null }
type Prices = NonNullable<ReturnType<typeof useProductListPrices>['data']>

// Writes on this card refresh only the price reads: the product form above
// keeps what is being typed into it.
function usePriceWrite<TVariables>(write: (variables: TVariables) => Promise<unknown>) {
  const client = useQueryClient()
  const { storeId } = useSession()
  return useResourceMutation({
    mutationFn: write,
    successMessage: false,
    errorMessage: false,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: goodsKey(storeId, 'list-prices') }),
        client.invalidateQueries({ queryKey: goodsKey(storeId, 'price-lists') }),
      ]),
  })
}

// The Spree price lists that price the product, with its own price in each
// and quantity breaks on lists with a volume rule.
export function GoodsProductPriceLists({
  productId,
  variants,
  currency,
  timeZone,
  canWrite,
}: {
  productId: string
  variants: ProductVariant[]
  currency: string
  timeZone: string
  canWrite: boolean
}) {
  const { t, i18n } = useTranslation()
  const confirm = useConfirm()
  const variantIds = useMemo(() => variants.map((variant) => variant.id), [variants])
  const lists = useGoodsPriceLists()
  const prices = useProductListPrices(variantIds, currency)
  const remove = usePriceWrite(removeFromPriceList)
  const [editing, setEditing] = useState<{ list: PriceListSlice; join: boolean } | null>(null)
  const [adding, setAdding] = useState('')
  const [problem, setProblem] = useState('')
  const failure = lists.error ?? prices.error
  if (failure)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{describeFailure(failure, t)}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void Promise.all([lists.refetch(), prices.refetch()])}
        >
          {t('retry')}
        </Button>
      </div>
    )
  if (lists.isPending || (variantIds.length > 0 && prices.isPending))
    return (
      <p role="status" className="text-sm">
        {t('waiting')}
      </p>
    )
  const rows = prices.data ?? []
  const pricing = new Set(listsPricing(rows))
  const allLists = lists.data ?? []
  const containing = allLists.filter((list) => pricing.has(list.id))
  const others = allLists.filter((list) => !pricing.has(list.id))
  const period = (list: PriceListSlice) =>
    list.starts_at || list.ends_at
      ? `${modelDate(list.starts_at, i18n.language, timeZone)} – ${list.ends_at ? modelDate(list.ends_at, i18n.language, timeZone) : t('goods.products.form.priceLists.noEnd')}`
      : t('goods.products.form.priceLists.always')

  async function removeList(list: PriceListSlice) {
    setProblem('')
    const ok = await confirm({
      message: t('goods.products.form.priceLists.removeConfirm', { name: list.name }),
      variant: 'destructive',
      confirmLabel: t('goods.products.form.priceLists.remove'),
      cancelLabel: t('adminCancel'),
    })
    if (!ok) return
    try {
      await remove.mutateAsync({ listId: list.id, productId })
    } catch (error) {
      setProblem(describeFailure(error, t))
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('goods.products.form.priceLists.hint')}</p>
      {allLists.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('goods.products.form.priceLists.none')}</p>
      ) : containing.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('goods.products.form.priceLists.notIn')}</p>
      ) : (
        <ul
          className="divide-y rounded-md border"
          aria-label={t('goods.products.form.priceLists.title')}
        >
          {containing.map((list) => {
            const summary = listPriceSummary(listPriceRows(variantIds, rows, list.id, currency))
            const rule = volumeRule(list)
            return (
              <li key={list.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {list.name}{' '}
                    <Badge variant="outline">
                      {t(`goods.products.form.priceLists.status_${list.status}`, {
                        defaultValue: list.status,
                      })}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {period(list)}
                    {' · '}
                    {summary.min
                      ? formatRange({ min: summary.min, max: summary.max ?? summary.min }, currency)
                      : t('goods.products.form.priceLists.basePrice')}
                    {summary.tiers > 0 &&
                      ` · ${t('goods.products.form.priceLists.tierCount', { count: summary.tiers })}`}
                    {rule && ` · ${t('goods.products.form.priceLists.volume')}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={t('goods.products.form.priceLists.editFor', { name: list.name })}
                    onClick={() => setEditing({ list, join: false })}
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
                      disabled={remove.isPending}
                      aria-label={t('goods.products.form.priceLists.removeFrom', {
                        name: list.name,
                      })}
                      onClick={() => void removeList(list)}
                    >
                      {t('goods.products.form.priceLists.remove')}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {canWrite && others.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56">
            <TopologyField label={t('goods.products.form.priceLists.addTo')}>
              {(id) => (
                <TopologySelect
                  id={id}
                  value={adding}
                  options={[
                    { value: '', label: t('goods.products.form.priceLists.pick') },
                    ...others.map((list) => ({ value: list.id, label: list.name })),
                  ]}
                  onChange={setAdding}
                />
              )}
            </TopologyField>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!adding}
            onClick={() => {
              const list = others.find((item) => item.id === adding)
              if (list) setEditing({ list, join: true })
            }}
          >
            {t('goods.products.form.priceLists.add')}
          </Button>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {editing && (
        <ListPriceDialog
          list={editing.list}
          join={editing.join}
          productId={productId}
          variants={variants}
          prices={rows}
          currency={currency}
          canWrite={canWrite}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setAdding('')
          }}
        />
      )}
    </div>
  )
}

function ListPriceDialog({
  list,
  join,
  productId,
  variants,
  prices,
  currency,
  canWrite,
  onClose,
  onSaved,
}: {
  list: PriceListSlice
  join: boolean
  productId: string
  variants: ProductVariant[]
  prices: Prices
  currency: string
  canWrite: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const initial = useMemo(
    () =>
      listPriceRows(
        variants.map((variant) => variant.id),
        prices,
        list.id,
        currency,
      ),
    [variants, prices, list.id, currency],
  )
  const [draft, setDraft] = useState<ListPriceRow[]>(initial)
  const [errors, setErrors] = useState<ListPriceErrors>({})
  const [problem, setProblem] = useState('')
  const save = usePriceWrite(saveListPrices)
  const rule = volumeRule(list)
  const tiered = Boolean(rule) || initial.some((row) => row.tiers.length > 0)
  const dirty = join || JSON.stringify(draft) !== JSON.stringify(initial)
  const busy = save.isPending
  const message = (key: string) =>
    errors[key]
      ? t(`goods.products.form.priceLists.errors.${errors[key]}`, { max: MAX_RUNGS - 1 })
      : undefined
  const setRow = (variantId: string, patch: (row: ListPriceRow) => ListPriceRow) =>
    setDraft((rows) => rows.map((row) => (row.variantId === variantId ? patch(row) : row)))

  async function submit() {
    setProblem('')
    const changes = listPriceChanges(initial, draft, {
      listId: list.id,
      currency,
      parseAmount: parseAmount(currency),
    })
    setErrors(changes.errors)
    if (Object.keys(changes.errors).length > 0) return
    try {
      await save.mutateAsync({ listId: list.id, productId, join, ...changes })
      onSaved()
    } catch (error) {
      setProblem(describeFailure(error, t))
    }
  }

  return (
    <TopologyDialog
      title={t('goods.products.form.priceLists.dialogTitle', { name: list.name })}
      subtitle={
        rule
          ? t(
              rule.max
                ? 'goods.products.form.priceLists.volumeRange'
                : 'goods.products.form.priceLists.volumeFrom',
              {
                min: rule.min,
                max: rule.max,
              },
            )
          : t('goods.products.form.priceLists.dialogHint')
      }
      dirty={canWrite && dirty}
      busy={busy}
      onClose={onClose}
    >
      {(close) => (
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <DialogBody className="space-y-4">
            <fieldset disabled={busy || !canWrite} className="space-y-4">
              {draft.map((row) => {
                const variant = variants.find((item) => item.id === row.variantId)
                const label = variant?.label ?? row.variantId
                return (
                  <div key={row.variantId} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('goods.products.form.priceLists.base', {
                          amount: variant?.basePrice
                            ? formatMoney(variant.basePrice, currency)
                            : '—',
                        })}
                      </p>
                    </div>
                    <TopologyField
                      label={t('goods.products.form.priceLists.listPrice', { variant: label })}
                      hint={t('goods.products.form.priceLists.listPriceHint')}
                      error={message(amountErrorKey(row.variantId))}
                    >
                      {(id, describedBy) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          inputMode="numeric"
                          aria-invalid={Boolean(errors[amountErrorKey(row.variantId)])}
                          value={row.amount}
                          onChange={(event) =>
                            setRow(row.variantId, (current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                        />
                      )}
                    </TopologyField>
                    {tiered && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {t('goods.products.form.priceLists.tiers')}
                        </p>
                        {row.tiers.map((tier, index) => (
                          <div
                            key={tier.id ?? `new-${index}`}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <TopologyField
                              label={t('goods.products.form.priceLists.fromQuantity', {
                                variant: label,
                                index: index + 1,
                              })}
                              error={message(tierErrorKey(row.variantId, index, 'minQuantity'))}
                            >
                              {(id) => (
                                <Input
                                  id={id}
                                  inputMode="numeric"
                                  className="w-28"
                                  value={tier.minQuantity}
                                  onChange={(event) =>
                                    setRow(row.variantId, (current) => ({
                                      ...current,
                                      tiers: current.tiers.map((item, at) =>
                                        at === index
                                          ? { ...item, minQuantity: event.target.value }
                                          : item,
                                      ),
                                    }))
                                  }
                                />
                              )}
                            </TopologyField>
                            <TopologyField
                              label={t('goods.products.form.priceLists.tierPrice', {
                                variant: label,
                                index: index + 1,
                              })}
                              error={message(tierErrorKey(row.variantId, index, 'amount'))}
                            >
                              {(id) => (
                                <Input
                                  id={id}
                                  inputMode="numeric"
                                  value={tier.amount}
                                  onChange={(event) =>
                                    setRow(row.variantId, (current) => ({
                                      ...current,
                                      tiers: current.tiers.map((item, at) =>
                                        at === index
                                          ? { ...item, amount: event.target.value }
                                          : item,
                                      ),
                                    }))
                                  }
                                />
                              )}
                            </TopologyField>
                            <Button
                              type="button"
                              variant="outline"
                              aria-label={t('goods.products.form.priceLists.removeTier', {
                                variant: label,
                                index: index + 1,
                              })}
                              onClick={() =>
                                setRow(row.variantId, (current) => ({
                                  ...current,
                                  tiers: current.tiers.filter((_, at) => at !== index),
                                }))
                              }
                            >
                              {t('goods.products.form.priceLists.removeTierShort')}
                            </Button>
                          </div>
                        ))}
                        {message(`${row.variantId}.tiers`) && (
                          <p role="alert" className="text-sm text-destructive">
                            {message(`${row.variantId}.tiers`)}
                          </p>
                        )}
                        {row.tiers.length < MAX_RUNGS - 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={t('goods.products.form.priceLists.addTierFor', {
                              variant: label,
                            })}
                            onClick={() =>
                              setRow(row.variantId, (current) => ({
                                ...current,
                                tiers: [
                                  ...current.tiers,
                                  { id: null, minQuantity: '', amount: '' },
                                ],
                              }))
                            }
                          >
                            {t('goods.products.form.priceLists.addTier')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </fieldset>
            {problem && (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              {t(canWrite ? 'adminCancel' : 'adminClose')}
            </Button>
            {canWrite && (
              <Button type="submit" disabled={busy || !dirty}>
                {t(busy ? 'waiting' : 'save')}
              </Button>
            )}
          </DialogFooter>
        </form>
      )}
    </TopologyDialog>
  )
}
