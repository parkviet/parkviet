import { labelsPerPage, productLabelPreset } from '@shared/product-label/presets'
import type { LabelItem } from '@shared/product-label/render'
import { describeFailure } from '@shared/request-failure'
import type { Printer } from '@shared/types/print-adapter'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchInput,
} from '@spree/dashboard-ui'
import {
  AlertTriangleIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  Trash2Icon,
} from '@spree/dashboard-ui/icons'
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePrinters } from '../../hooks/use-printers'
import {
  type LabelPrintItem,
  MAX_LABEL_COPIES,
  MAX_LABEL_ITEMS,
  MAX_LABELS_PER_PRINT,
  useLabelVariantSearch,
  usePrintProductLabels,
  useProductLabelData,
} from '../../hooks/use-product-label-data'
import { useProductLabelTemplates } from '../../hooks/use-product-label-templates'
import { TopologySelect } from '../topology-fields'
import { buildLabelsDocument, LabelFrame, useLabelPrint } from './label-card-preview'
import { StartCellPicker } from './start-cell-picker'

const isLabelPrinter = (printer: Printer) =>
  printer.status === 'active' && printer.roles.includes('product_label')

const WARNING_KEYS = [
  'no_code',
  'no_price',
  'not_sold_in_branch',
  'barcode_too_wide',
  'barcode_unsupported',
] as const

function merge(items: readonly LabelPrintItem[]): LabelPrintItem[] {
  const byId = new Map<string, number>()
  for (const item of items)
    byId.set(
      item.variantId,
      Math.min(MAX_LABEL_COPIES, (byId.get(item.variantId) ?? 0) + Math.max(1, item.quantity)),
    )
  return [...byId].map(([variantId, quantity]) => ({ variantId, quantity }))
}

// Prints product labels for a list of variants, through the browser or a
// branch label printer: each row is a variant with its copies, the template
// and (on a sheet) the first cell are chosen, and every page is previewed
// before it goes to the printer. Only roll stocks reach a label printer; a
// sheet prints from the browser.
// Callers hand in variant ids and copies only, so the dialog can open from
// any list of goods.
export function PrintLabelsDialog({
  branchId,
  timeZone,
  items,
  onClose,
}: {
  branchId: string
  timeZone: string
  items: readonly LabelPrintItem[]
  onClose: () => void
}) {
  const { t } = useTranslation('pos')
  const id = useId()
  const [rows, setRows] = useState<LabelPrintItem[]>(() => merge(items))
  const [templateId, setTemplateId] = useState('')
  const [startCell, setStartCell] = useState(1)
  const [search, setSearch] = useState('')
  const [printFailed, setPrintFailed] = useState(false)
  const [printerId, setPrinterId] = useState('browser')
  const [sent, setSent] = useState<string | null>(null)
  const attempt = useRef<{ signature: string; key: string } | null>(null)

  const templates = useProductLabelTemplates(true, false)
  const templateRows = templates.data ?? []
  const template =
    templateRows.find((row) => row.id === templateId) ??
    templateRows.find((row) => row.is_default) ??
    templateRows[0]
  const preset = template ? productLabelPreset(template.paper) : null

  const printers = usePrinters(branchId)
  const labelPrinters = useMemo(
    () => (preset?.kind === 'roll' ? (printers.data ?? []).filter(isLabelPrinter) : []),
    [preset, printers.data],
  )
  // A printer chosen for a roll stays chosen only while the stock is a roll.
  const stationPrinter = labelPrinters.find((printer) => printer.id === printerId) ?? null
  const send = usePrintProductLabels(branchId)

  const tooManyRows = rows.length > MAX_LABEL_ITEMS
  const label = useProductLabelData(
    branchId,
    rows.map((row) => row.variantId),
  )
  const lines = label.data?.data
  const byVariant = useMemo(
    () => new Map((lines ?? []).map((line) => [line.variant_id, line])),
    [lines],
  )
  const totalLabels = rows.reduce((sum, row) => sum + row.quantity, 0)
  const tooManyLabels = totalLabels > MAX_LABELS_PER_PRINT

  const labelItems = useMemo<LabelItem[]>(
    () =>
      rows.flatMap((row) => {
        const line = byVariant.get(row.variantId)
        return line ? [{ ...line, quantity: row.quantity }] : []
      }),
    [rows, byVariant],
  )
  const store = label.data?.store ?? null
  const cell = preset?.kind === 'sheet' ? Math.min(startCell, labelsPerPage(preset)) : 1
  const built = useMemo(
    () =>
      template && preset && !tooManyLabels && labelItems.length > 0
        ? buildLabelsDocument(
            template.config,
            preset,
            labelItems,
            { store, timeZone },
            t('productLabelPrint.title'),
            cell,
          )
        : null,
    [template, preset, tooManyLabels, labelItems, store, timeZone, t, cell],
  )

  const onPrintFailed = useCallback(() => setPrintFailed(true), [])
  const print = useLabelPrint(onPrintFailed)

  const setQuantity = (variantId: string, quantity: number) =>
    setRows((current) =>
      current.map((row) =>
        row.variantId === variantId
          ? { ...row, quantity: Math.min(MAX_LABEL_COPIES, Math.max(1, Math.floor(quantity) || 1)) }
          : row,
      ),
    )
  const remove = (variantId: string) =>
    setRows((current) => current.filter((row) => row.variantId !== variantId))
  const add = (variantId: string) => {
    setRows((current) => merge([...current, { variantId, quantity: 1 }]))
    setSearch('')
  }

  const found = useLabelVariantSearch(branchId, search)
  const addable = (found.data ?? []).filter(
    (variant) => !rows.some((r) => r.variantId === variant.id),
  )

  const ready =
    built !== null &&
    !label.isError &&
    !label.isPlaceholderData &&
    !tooManyRows &&
    !print.printing &&
    !send.isPending

  const sendToPrinter = () => {
    if (!template || !stationPrinter) return
    setSent(null)
    const signature = JSON.stringify([template.id, stationPrinter.id, rows])
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() }
    send.mutate(
      {
        templateId: template.id,
        printerId: stationPrinter.id,
        items: rows,
        key: attempt.current.key,
      },
      {
        onSuccess: (jobs) => {
          attempt.current = null
          setSent(
            t('productLabelPrint.sent', {
              n: totalLabels,
              name: stationPrinter.name,
              jobs: jobs.length,
            }),
          )
        },
      },
    )
  }
  const warningText = (code: string) =>
    (WARNING_KEYS as readonly string[]).includes(code) ? t(`productLabelPrint.warn.${code}`) : code

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('productLabelPrint.title')}</DialogTitle>
          <DialogDescription>{t('productLabelPrint.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          <section className="grid gap-2" aria-label={t('productLabelPrint.rows')}>
            {rows.length === 0 ? (
              <p className="text-muted-foreground" role="status">
                {t('productLabelPrint.empty')}
              </p>
            ) : (
              <ul className="grid gap-2">
                {rows.map((row) => {
                  const line = byVariant.get(row.variantId)
                  const warnings = [
                    ...new Set([
                      ...(line?.warnings ?? []),
                      ...(built?.warningsByVariant.get(row.variantId) ?? []),
                    ]),
                  ]
                  return (
                    <li
                      key={row.variantId}
                      data-testid="label-row"
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
                    >
                      <div className="grid min-w-0 gap-0.5">
                        <span className="truncate font-medium">
                          {line
                            ? [line.product_name, line.variant_options].filter(Boolean).join(' · ')
                            : '…'}
                        </span>
                        <small className="truncate text-muted-foreground">
                          {line
                            ? [line.sku, line.barcode].filter(Boolean).join(' · ') ||
                              t('productLabelPrint.noCodeShort')
                            : ''}
                        </small>
                        {warnings.length > 0 && (
                          <ul className="grid gap-0.5">
                            {warnings.map((code) => (
                              <li
                                key={code}
                                data-warning={code}
                                className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                              >
                                <AlertTriangleIcon className="size-3.5 shrink-0" />
                                {warningText(code)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="grid text-sm sm:text-right">
                        <span className="text-muted-foreground">
                          {t('productLabelPrint.unit')}: {line?.unit ?? '…'}
                        </span>
                        <span className="tabular-nums" data-testid="label-row-price">
                          {line?.price
                            ? `${line.price} ${line.currency}`
                            : t('productLabelPrint.noPrice')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={t('productLabelPrint.copiesLess')}
                          disabled={row.quantity <= 1}
                          onClick={() => setQuantity(row.variantId, row.quantity - 1)}
                        >
                          <MinusIcon className="size-4" />
                        </Button>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_LABEL_COPIES}
                          aria-label={t('productLabelPrint.copies')}
                          className="w-16 text-center"
                          value={row.quantity}
                          onChange={(event) =>
                            setQuantity(row.variantId, Number(event.target.value))
                          }
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={t('productLabelPrint.copiesMore')}
                          disabled={row.quantity >= MAX_LABEL_COPIES}
                          onClick={() => setQuantity(row.variantId, row.quantity + 1)}
                        >
                          <PlusIcon className="size-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t('productLabelPrint.removeRow')}
                        onClick={() => remove(row.variantId)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="grid gap-1">
              <Label htmlFor={`${id}-add`}>{t('productLabelPrint.addVariant')}</Label>
              <SearchInput
                id={`${id}-add`}
                value={search}
                onValueChange={setSearch}
                placeholder={t('productLabelPrint.addVariantPlaceholder')}
                clearLabel={t('productLabelPrint.clearSearch')}
              />
              {search.trim() !== '' && found.data && (
                <ul
                  className="grid gap-1 rounded-md border p-1"
                  data-testid="label-variant-results"
                >
                  {addable.length === 0 ? (
                    <li className="px-2 py-1 text-sm text-muted-foreground">
                      {t('productLabelPrint.noVariants')}
                    </li>
                  ) : (
                    addable.map((variant) => (
                      <li key={variant.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                          onClick={() => add(variant.id)}
                        >
                          <span className="truncate">{variant.name}</span>
                          <small className="shrink-0 text-muted-foreground">
                            {variant.sku || variant.barcode || ''}
                          </small>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            {tooManyRows && (
              <p role="alert" className="text-destructive">
                {t('productLabelPrint.tooManyRows', { max: MAX_LABEL_ITEMS })}
              </p>
            )}
            {tooManyLabels && (
              <p role="alert" className="text-destructive">
                {t('productLabelPrint.tooManyLabels', { max: MAX_LABELS_PER_PRINT })}
              </p>
            )}
            {label.isError && (
              <p role="alert" className="text-destructive">
                {t('productLabelPrint.dataFailed', { reason: describeFailure(label.error, t) })}
              </p>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-template`}>{t('productLabelPrint.template')}</Label>
                <TopologySelect
                  id={`${id}-template`}
                  value={template?.id ?? ''}
                  onChange={setTemplateId}
                  options={templateRows.map((row) => ({
                    value: row.id,
                    label: `${row.name} · ${t(`productLabels.paperName.${row.paper}`)}`,
                  }))}
                />
                {templates.isSuccess && templateRows.length === 0 && (
                  <small role="alert" className="text-destructive">
                    {t('productLabelPrint.noTemplates')}
                  </small>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-printer`}>{t('productLabelPrint.printer')}</Label>
                <TopologySelect
                  id={`${id}-printer`}
                  value={stationPrinter?.id ?? 'browser'}
                  onChange={(value) => {
                    setPrinterId(value)
                    setSent(null)
                    send.reset()
                  }}
                  options={[
                    { value: 'browser', label: t('productLabelPrint.printerBrowser') },
                    ...labelPrinters.map((printer) => ({ value: printer.id, label: printer.name })),
                  ]}
                />
                {preset?.kind === 'sheet' && (printers.data ?? []).some(isLabelPrinter) && (
                  <small className="text-muted-foreground">
                    {t('productLabelPrint.printerSheet')}
                  </small>
                )}
              </div>
              {preset?.kind === 'sheet' && (
                <StartCellPicker preset={preset} value={cell} onChange={setStartCell} />
              )}
              {!stationPrinter && (
                <p className="text-sm text-muted-foreground">{t('productLabelPrint.paperNote')}</p>
              )}
            </div>
            <div className="grid content-start gap-2">
              <p className="text-sm font-medium" data-testid="label-counts" role="status">
                {built
                  ? t('productLabelPrint.counts', { pages: built.pages, n: built.labels })
                  : t('productLabelPrint.previewPending')}
              </p>
              {built && (
                <LabelFrame
                  document={built.preview}
                  title={t('productLabelPrint.preview')}
                  testId="product-label-print-preview"
                  maxHeightPx={420}
                />
              )}
            </div>
          </section>
          {printFailed && (
            <p role="alert" className="text-destructive">
              {t('productLabelPrint.printFailed')}
            </p>
          )}
          {send.isError && (
            <p role="alert" className="text-destructive">
              {t('productLabelPrint.sendFailed', { reason: describeFailure(send.error, t) })}
            </p>
          )}
          {sent && (
            <p role="status" data-testid="label-sent">
              {sent}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('productLabelPrint.close')}
          </Button>
          <Button
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!built) return
              setPrintFailed(false)
              if (stationPrinter) {
                sendToPrinter()
                return
              }
              setSent(null)
              print.start(built.printHtml)
            }}
          >
            <PrinterIcon className="size-4" />
            {t('productLabelPrint.print', { n: built?.labels ?? 0 })}
          </Button>
        </DialogFooter>
        {print.frame}
      </DialogContent>
    </Dialog>
  )
}
