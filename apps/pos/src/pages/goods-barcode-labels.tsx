import { formatMoney } from '@shared/money'
import { describeFailure } from '@shared/request-failure'
import type { PosBranch } from '@shared/types/pos-context'
import { PageHeader, usePermissions } from '@spree/dashboard-core'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  SearchInput,
  useConfirm,
} from '@spree/dashboard-ui'
import { MinusIcon, PlusIcon, PrinterIcon, TagIcon, Trash2Icon } from '@spree/dashboard-ui/icons'
import { Link } from '@tanstack/react-router'
import { type KeyboardEvent, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { PageSkeleton } from '../components/page-skeleton'
import { PrintLabelsDialog } from '../components/product-label/print-labels-dialog'
import { ModelState } from '../components/setup/model-ui'
import { fetchCatalogPage } from '../hooks/use-catalog'
import { findVariantsByBarcode, useVariantBasePrices } from '../hooks/use-goods-barcode-labels'
import { usePosSession } from '../hooks/use-pos-session'
import {
  type LabelPrintItem,
  MAX_LABEL_COPIES,
  MAX_LABEL_ITEMS,
  MAX_LABELS_PER_PRINT,
  useLabelVariantSearch,
  useProductLabelData,
} from '../hooks/use-product-label-data'
import { useSession } from '../hooks/use-session'
import {
  addPick,
  applyCountToAll,
  clampCount,
  countsFromStock,
  type LabelPick,
  labelPrices,
  type PickSource,
  printItems,
  setPickCount,
  totalLabels,
} from '../lib/goods-barcode-labels'
import { type PosAccess, routeAllowed } from '../lib/pos-access'

type Notice = { text: string; failed: boolean }

// "In tem mã vạch": pick the goods sold at the selected branch (search or
// scan), set how many labels each gets, then print them through the shared
// product label dialog, which chooses the label template and the printer.
export function GoodsBarcodeLabelsPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context, selection } = usePosSession()
  const { permissionKeys } = usePermissions()
  const access: PosAccess = { permissionKeys, context: context.data }
  const branch =
    (context.data?.branches ?? []).find(
      (row) => row.id === selection.branchId && row.status === 'active',
    ) ?? null
  const currency = context.data?.store.currency ?? 'VND'

  const header = (
    <PageHeader
      title={t('goods.barcodeLabels.title')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <BranchPicker />
          {routeAllowed('receipt-templates', access) && (
            <Button asChild variant="outline" size="sm">
              <Link
                to="/$storeId/settings/receipt-templates"
                params={{ storeId }}
                search={{ tab: 'labels' }}
              >
                <TagIcon className="size-4" />
                {t('goods.barcodeLabels.templates')}
              </Link>
            </Button>
          )}
          {routeAllowed('labels', access) && (
            <Button asChild variant="outline" size="sm">
              <Link to="/$storeId/scale-labels" params={{ storeId }}>
                {t('goods.barcodeLabels.scaleLabels')}
              </Link>
            </Button>
          )}
        </div>
      }
    />
  )
  if (context.isPending) return <PageSkeleton variant="page" />
  return (
    <div className="space-y-6">
      {header}
      {branch ? (
        <LabelPicker key={branch.id} branch={branch} currency={currency} />
      ) : (
        <ModelState title={t('goods.barcodeLabels.noBranch')} />
      )}
    </div>
  )
}

// The pick list belongs to one branch: stock and prices are the branch's,
// so another branch starts a new list.
function LabelPicker({ branch, currency }: { branch: PosBranch; currency: string }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const id = useId()
  const [picks, setPicks] = useState<LabelPick[]>([])
  const [search, setSearch] = useState('')
  const [perProduct, setPerProduct] = useState(1)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [scanning, setScanning] = useState(false)
  const [dialogItems, setDialogItems] = useState<LabelPrintItem[] | null>(null)

  const ids = useMemo(() => picks.map((pick) => pick.variantId), [picks])
  const found = useLabelVariantSearch(branch.id, search)
  const basePrices = useVariantBasePrices(ids, currency)
  const labelData = useProductLabelData(branch.id, ids)
  const lines = useMemo(
    () => new Map((labelData.data?.data ?? []).map((line) => [line.variant_id, line])),
    [labelData.data],
  )
  const total = totalLabels(picks)
  const toPrint = printItems(picks)
  const tooManyLabels = total > MAX_LABELS_PER_PRINT
  const money = (amount: string | null) => formatMoney(amount, currency)

  const add = (source: PickSource) => {
    const result = addPick(picks, source)
    setPicks(result.picks)
    setNotice(
      result.outcome === 'full'
        ? { text: t('goods.barcodeLabels.tooManyRows', { max: MAX_LABEL_ITEMS }), failed: true }
        : null,
    )
    if (result.outcome !== 'full') setSearch('')
  }

  // A scanner types the code and presses Enter: an exact barcode adds that
  // variant (again: one more label), otherwise a single search hit is added.
  const submitSearch = async () => {
    const text = search.trim()
    if (text === '' || scanning) return
    setScanning(true)
    setNotice(null)
    try {
      const exact = await findVariantsByBarcode(branch.id, text)
      if (exact.length > 1) {
        setNotice({ text: t('goods.barcodeLabels.ambiguous', { code: text }), failed: true })
        return
      }
      const hit =
        exact[0] ??
        (await (async () => {
          const rows = (await fetchCatalogPage(branch.id, { q: text, limit: 2 })).data
          return rows.length === 1 ? rows[0] : undefined
        })())
      if (hit) add(hit)
      else setNotice({ text: t('goods.barcodeLabels.pickFromList', { code: text }), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    } finally {
      setScanning(false)
    }
  }
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void submitSearch()
  }

  const clearAll = async () => {
    if (
      !(await confirm({
        title: t('goods.barcodeLabels.clearTitle'),
        message: t('goods.barcodeLabels.clearConfirm', { count: picks.length }),
        variant: 'destructive',
        confirmLabel: t('goods.barcodeLabels.clear'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setPicks([])
    setNotice(null)
  }

  const results = search.trim() !== '' ? found.data : undefined

  return (
    <>
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-search`}>{t('goods.barcodeLabels.search')}</Label>
            <SearchInput
              id={`${id}-search`}
              autoFocus
              value={search}
              onValueChange={(value) => {
                setSearch(value)
                setNotice(null)
              }}
              onKeyDown={onSearchKey}
              aria-busy={scanning}
              placeholder={t('goods.barcodeLabels.searchPlaceholder')}
              clearLabel={t('goods.barcodeLabels.clearSearch')}
            />
            {found.isError && search.trim() !== '' && (
              <p role="alert" className="text-sm text-destructive">
                {describeFailure(found.error, t)}
              </p>
            )}
            {results && (
              <ul
                className="grid gap-1 rounded-md border p-1"
                data-testid="barcode-label-results"
                aria-label={t('goods.barcodeLabels.results')}
              >
                {results.length === 0 ? (
                  <li className="px-2 py-1 text-sm text-muted-foreground">
                    {t('goods.barcodeLabels.noResults')}
                  </li>
                ) : (
                  results.map((variant) => (
                    <li key={variant.id}>
                      <button
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => add(variant)}
                      >
                        <span className="grid min-w-0">
                          <span className="truncate">{variant.name}</span>
                          <small className="truncate text-muted-foreground">
                            {[variant.sku, variant.barcode].filter(Boolean).join(' · ')}
                          </small>
                        </span>
                        <span className="grid text-right tabular-nums">
                          <span>{money(variant.price)}</span>
                          <small className="text-muted-foreground">
                            {t('goods.barcodeLabels.stockShort', {
                              stock: variant.stock_on_hand ?? '—',
                            })}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {notice && (
            <p
              role={notice.failed ? 'alert' : 'status'}
              className={
                notice.failed ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
              }
            >
              {notice.text}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-per`}>{t('goods.barcodeLabels.perProduct')}</Label>
              <Input
                id={`${id}-per`}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_LABEL_COPIES}
                className="w-24"
                value={perProduct}
                onChange={(event) => setPerProduct(clampCount(Number(event.target.value)))}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={picks.length === 0}
              onClick={() => setPicks(applyCountToAll(picks, perProduct))}
            >
              {t('goods.barcodeLabels.applyAll')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={picks.length === 0}
              onClick={() => setPicks(countsFromStock(picks))}
            >
              {t('goods.barcodeLabels.byStock')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              disabled={picks.length === 0}
              onClick={() => void clearAll()}
            >
              <Trash2Icon className="size-4" />
              {t('goods.barcodeLabels.clear')}
            </Button>
          </div>

          {picks.length === 0 ? (
            <p className="text-muted-foreground" role="status">
              {t('goods.barcodeLabels.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label={t('goods.barcodeLabels.picked')}>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t('goods.barcodeLabels.product')}</th>
                    <th className="py-2 pr-3 font-medium">{t('goods.barcodeLabels.sku')}</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      {t('goods.barcodeLabels.price')}
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      {t('goods.barcodeLabels.promoPrice')}
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      {t('goods.barcodeLabels.stock')}
                    </th>
                    <th className="py-2 pr-3 font-medium">{t('goods.barcodeLabels.count')}</th>
                    <th className="py-2">
                      <span className="sr-only">{t('goods.barcodeLabels.remove')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick) => {
                    const line = lines.get(pick.variantId)
                    const name = [pick.name, line?.variant_options].filter(Boolean).join(' · ')
                    const prices = basePrices.isPending
                      ? null
                      : labelPrices(basePrices.data?.get(pick.variantId), pick.channelPrice)
                    return (
                      <tr
                        key={pick.variantId}
                        data-testid="barcode-label-row"
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-3">
                          <span className="font-medium">{name}</span>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          <span className="grid">
                            <span>{pick.sku || '—'}</span>
                            {pick.barcode && <small>{pick.barcode}</small>}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums" data-testid="price">
                          {prices ? money(prices.price) : '…'}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums" data-testid="promo">
                          {prices ? (prices.promo ? money(prices.promo) : '—') : '…'}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums" data-testid="stock">
                          {pick.stock ?? '—'}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={t('goods.barcodeLabels.less', { name })}
                              disabled={pick.count <= 0}
                              onClick={() =>
                                setPicks(setPickCount(picks, pick.variantId, pick.count - 1))
                              }
                            >
                              <MinusIcon className="size-4" />
                            </Button>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={MAX_LABEL_COPIES}
                              aria-label={t('goods.barcodeLabels.countFor', { name })}
                              className="w-20 text-center"
                              value={pick.count}
                              onChange={(event) =>
                                setPicks(
                                  setPickCount(picks, pick.variantId, Number(event.target.value)),
                                )
                              }
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={t('goods.barcodeLabels.more', { name })}
                              disabled={pick.count >= MAX_LABEL_COPIES}
                              onClick={() =>
                                setPicks(setPickCount(picks, pick.variantId, pick.count + 1))
                              }
                            >
                              <PlusIcon className="size-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t('goods.barcodeLabels.removeFor', { name })}
                            onClick={() =>
                              setPicks(picks.filter((row) => row.variantId !== pick.variantId))
                            }
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {basePrices.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t('goods.barcodeLabels.basePriceFailed', {
                reason: describeFailure(basePrices.error, t),
              })}
            </p>
          )}
          {tooManyLabels && (
            <p role="alert" className="text-sm text-destructive">
              {t('goods.barcodeLabels.tooManyLabels', { max: MAX_LABELS_PER_PRINT })}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm text-muted-foreground" data-testid="barcode-label-total">
              {t('goods.barcodeLabels.total', { products: toPrint.length, count: total })}
            </span>
            <Button
              type="button"
              disabled={toPrint.length === 0 || tooManyLabels}
              onClick={() => setDialogItems(toPrint)}
            >
              <PrinterIcon className="size-4" />
              {t('goods.barcodeLabels.print', { count: total })}
            </Button>
          </div>
        </CardContent>
      </Card>
      {dialogItems && (
        <PrintLabelsDialog
          branchId={branch.id}
          timeZone={branch.timezone || 'Asia/Ho_Chi_Minh'}
          items={dialogItems}
          onClose={() => setDialogItems(null)}
        />
      )}
    </>
  )
}
