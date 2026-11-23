import receiptCss from '@shared/receipt.css?inline'
import { snapshotData, type TemplateData } from '@shared/receipt-template/data'
import { renderDocument } from '@shared/receipt-template/render'
import { sampleData, withLogo } from '@shared/receipt-template/sample-data'
import { renderSheetHtml } from '@shared/receipt-template/sheet-html'
import type {
  PaperSize,
  PrintDocument,
  ReceiptDocumentType,
  TemplateConfig,
} from '@shared/receipt-template/types'
import type { PosBranch, PosContext, PosRegister } from '@shared/types/pos-context'
import type { ReceiptSnapshot } from '@shared/types/print-adapter'
import { EyeIcon } from '@spree/dashboard-ui/icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLatestReceipt } from '../../hooks/use-receipt-templates'
import { ModelCard } from '../setup/model-ui'
import { Choice, SegmentedChoice } from './controls'

export type PreviewSource = 'sample' | 'latest'
export type PreviewZoom = '75' | '100' | 'fit'

const RECEIPT_SOURCES = {
  sale: 'sale',
  return: 'return',
  refund: 'refund',
  shift_closure: 'shift_closure',
} as const
export type PreviewStatus = 'sample' | 'loading' | 'latest' | 'empty' | 'failed'

const FRAME_HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'
const PAPER_WIDTH: Record<PaperSize, string> = {
  '58mm': '58mm',
  '80mm': '80mm',
  a4: '210mm',
  a5: '148mm',
  a6: '105mm',
}
const PAPER_MM: Record<PaperSize, number> = {
  '58mm': 58,
  '80mm': 80,
  a4: 210,
  a5: 148,
  a6: 105,
}
const THUMB_SCALE: Record<PaperSize, number> = {
  '58mm': 0.76,
  '80mm': 0.68,
  a6: 0.52,
  a5: 0.4,
  a4: 0.3,
}
const PX_PER_MM = 96 / 25.4

export function usePreviewData({
  documentType,
  source,
  context,
  branch,
  register,
}: {
  documentType: ReceiptDocumentType
  source: PreviewSource
  context: PosContext | undefined
  branch: PosBranch | null
  register: PosRegister | null
}): { data: TemplateData; status: PreviewStatus; latestReceipt: ReceiptSnapshot | null } {
  const { t } = useTranslation('pos')
  const sourceType = RECEIPT_SOURCES[documentType as keyof typeof RECEIPT_SOURCES] ?? null
  const wantsLatest = source === 'latest' && sourceType !== null && branch !== null
  const latest = useLatestReceipt(branch?.id ?? null, sourceType, wantsLatest)
  const place = useMemo(
    () => ({
      storeName: context?.store.name ?? null,
      storeProfile: context?.store.profile ?? null,
      branchName: branch?.name ?? null,
      branchCode: branch?.code ?? null,
      returnWindowDays: branch?.return_window_days ?? null,
      registerName: register?.name ?? null,
      cashier: context?.staff.full_name || context?.staff.email || null,
      timeZone: branch?.timezone ?? context?.store.timezone ?? null,
    }),
    [context, branch, register],
  )
  const now = useMemo(() => new Date(), [])
  return useMemo(() => {
    if (wantsLatest && latest.data)
      return {
        data: withLogo(snapshotData(latest.data, t), place),
        status: 'latest',
        latestReceipt: latest.data,
      }
    const status: PreviewStatus = !wantsLatest
      ? 'sample'
      : latest.isPending
        ? 'loading'
        : latest.isError
          ? 'failed'
          : 'empty'
    return { data: sampleData(documentType, place, t, now), status, latestReceipt: null }
  }, [wantsLatest, latest.data, latest.isPending, latest.isError, documentType, place, t, now])
}

function legacyMissingFields(
  receipt: ReceiptSnapshot | null,
  config: TemplateConfig,
  t: (key: string) => string,
): string[] {
  if (receipt?.source_type !== 'sale') return []
  const doc = receipt.document
  if ('item_count' in doc || 'check_in_at' in doc) return []
  const missing: string[] = []
  const meta = new Set<string>(config.meta?.fields ?? [])
  const cols = new Set<string>(config.lines?.columns ?? [])
  const totals = new Set<string>(config.totals?.fields ?? [])
  const payments = new Set<string>(config.payments?.fields ?? [])
  const lines = Array.isArray(doc.lines) ? (doc.lines as Record<string, unknown>[]) : []
  const store =
    typeof doc.store === 'object' && doc.store !== null
      ? (doc.store as Record<string, unknown>)
      : {}

  const businessFields = new Set<string>(
    [...config.header, ...config.footer].flatMap((b) => (b.type === 'business' ? b.fields : [])),
  )
  if (businessFields.has('tax_code') && !('tax_code' in store))
    missing.push(t('receiptTemplates.business.tax_code'))
  if (businessFields.has('description') && !('description' in store))
    missing.push(t('receiptTemplates.business.description'))
  if (meta.has('table') && !('table' in doc)) missing.push(t('receiptTemplates.fields.meta.table'))
  if (meta.has('check_in') && !('check_in_at' in doc))
    missing.push(t('receiptTemplates.fields.meta.check_in'))
  if (meta.has('duration') && !('check_in_at' in doc))
    missing.push(t('receiptTemplates.fields.meta.duration'))
  if (meta.has('order_source') && !('order_source' in doc))
    missing.push(t('receiptTemplates.fields.meta.order_source'))
  if (cols.has('barcode') && !lines.some((l) => 'barcode' in l))
    missing.push(t('receiptTemplates.fields.lines.barcode'))
  if (cols.has('original_price') && !lines.some((l) => 'original_price' in l))
    missing.push(t('receiptTemplates.fields.lines.original_price'))
  if (cols.has('note') && !lines.some((l) => 'note' in l))
    missing.push(t('receiptTemplates.fields.lines.note'))
  if (totals.has('item_count') && !('item_count' in doc))
    missing.push(t('receiptTemplates.fields.totals.item_count'))
  if (totals.has('promotions') && !('promotions' in doc))
    missing.push(t('receiptTemplates.fields.totals.promotions'))
  if (payments.has('previous_debt') && !('customer_debt' in doc))
    missing.push(t('receiptTemplates.fields.payments.previous_debt'))
  if (payments.has('customer_debt') && !('customer_debt' in doc))
    missing.push(t('receiptTemplates.fields.payments.customer_debt'))
  if (payments.has('transfer_qr') && !('transfer_qr' in doc))
    missing.push(t('receiptTemplates.fields.payments.transfer_qr'))

  return missing
}

export function PreviewControls({
  documentType,
  source,
  status,
  branches,
  canReadReceipts,
  registers,
  branchId,
  registerId,
  onSource,
  onBranch,
  onRegister,
}: {
  documentType: ReceiptDocumentType
  source: PreviewSource
  status: PreviewStatus
  branches: PosBranch[]
  canReadReceipts: boolean
  registers: PosRegister[]
  branchId: string
  registerId: string
  onSource: (source: PreviewSource) => void
  onBranch: (id: string) => void
  onRegister: (id: string) => void
}) {
  const { t } = useTranslation('pos')
  const hasReceipts = documentType in RECEIPT_SOURCES
  return (
    <div className="grid gap-2.5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Choice
          label={t('receiptTemplates.preview.source')}
          value={source}
          options={[
            { value: 'sample', label: t('receiptTemplates.preview.sample') },
            {
              value: 'latest',
              label: t('receiptTemplates.preview.latest'),
              disabled: !hasReceipts || !canReadReceipts,
            },
          ]}
          onChange={onSource}
        />
        <Choice
          label={t('branch')}
          value={branchId}
          options={
            branches.length
              ? branches.map((branch) => ({ value: branch.id, label: branch.name }))
              : [{ value: '', label: t('receiptTemplates.preview.noBranch') }]
          }
          onChange={onBranch}
        />
        <Choice
          label={t('receiptTemplates.preview.register')}
          value={registerId}
          disabled={source === 'latest' && hasReceipts}
          options={[
            { value: '', label: t('receiptTemplates.preview.noRegister') },
            ...registers
              .filter((register) => register.branch_id === branchId)
              .map((register) => ({ value: register.id, label: register.name })),
          ]}
          onChange={onRegister}
        />
      </div>
      {!hasReceipts ? (
        <small className="text-xs text-muted-foreground">
          {t('receiptTemplates.preview.sampleOnly')}
        </small>
      ) : !canReadReceipts ? (
        <small className="text-xs text-muted-foreground">
          {t('receiptTemplates.preview.noMembership')}
        </small>
      ) : source === 'latest' ? (
        <small className="text-xs text-muted-foreground">
          {t('receiptTemplates.preview.memberBranches')}
        </small>
      ) : null}
      {status === 'loading' ? (
        <small role="status" className="text-xs">
          {t('waiting')}
        </small>
      ) : status === 'empty' ? (
        <small role="status" className="text-xs">
          {t('receiptTemplates.preview.noReceipt')}
        </small>
      ) : status === 'failed' ? (
        <small role="status" className="text-xs text-destructive">
          {t('receiptTemplates.preview.receiptFailed')}
        </small>
      ) : null}
    </div>
  )
}

export function PreviewZoomBar({
  value,
  onChange,
}: {
  value: PreviewZoom
  onChange: (zoom: PreviewZoom) => void
}) {
  const { t } = useTranslation('pos')
  return (
    <SegmentedChoice
      label={t('receiptTemplates.preview.zoom')}
      hideLabel
      value={value}
      className="w-auto min-w-[210px]"
      options={[
        { value: '75', label: t('receiptTemplates.preview.zoom75') },
        { value: '100', label: t('receiptTemplates.preview.zoom100') },
        { value: 'fit', label: t('receiptTemplates.preview.zoomFit') },
      ]}
      onChange={onChange}
    />
  )
}

// The frame shows the sheet markup the POS prints, from the shared sheet
// renderer, which escapes every template text and attribute value. srcDoc
// stays a fixed empty page, the sandbox runs no scripts, and neither
// dashboard CSS nor receipt CSS crosses the frame.
export function ReceiptFrame({
  document: printDocument,
  paper,
  title,
  testId,
  zoom = '100',
  markOverflow = false,
  onReady,
}: {
  document: PrintDocument
  paper: PaperSize
  title: string
  testId: string
  zoom?: PreviewZoom
  markOverflow?: boolean
  onReady?: (frame: HTMLIFrameElement) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLIFrameElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState(400)
  const [containerWidth, setContainerWidth] = useState(0)
  const naturalPx = PAPER_MM[paper] * PX_PER_MM

  const html = useMemo(
    () =>
      `<div class="receipt-print-root">${renderSheetHtml(printDocument, { paper, markOverflow, testId })}</div>`,
    [printDocument, paper, markOverflow, testId],
  )

  useEffect(() => {
    if (body) body.innerHTML = html
  }, [body, html])

  useEffect(() => {
    if (!body) return
    const measure = () => setHeight(Math.max(200, body.scrollHeight + 24))
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    measure()
    return () => observer.disconnect()
  }, [body])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const measure = () => setContainerWidth(node.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!body || !ref.current || !onReady) return
    const frame = ref.current
    let disposed = false
    const ready = async () => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const assets = Promise.all([
        frame.contentDocument?.fonts.ready,
        ...Array.from(body.querySelectorAll('img')).map((image) =>
          image.decode().catch(() => {
            image.hidden = true
          }),
        ),
      ])
      await Promise.race([
        assets,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1500)
        }),
      ])
      clearTimeout(timer)
      for (const image of body.querySelectorAll('img'))
        if (!image.complete || image.naturalWidth === 0) image.hidden = true
      if (!disposed) onReady(frame)
    }
    void ready()
    return () => {
      disposed = true
    }
  }, [body, onReady])

  const scale =
    zoom === '75'
      ? 0.75
      : zoom === 'fit' && containerWidth > 48
        ? Math.min(1, Math.max(0.35, (containerWidth - 32) / naturalPx))
        : 1

  return (
    <div
      ref={containerRef}
      data-zoom={zoom}
      className="max-w-full overflow-auto rounded-xl border bg-muted/60 p-4 sm:p-5"
    >
      <div
        className="mx-auto"
        style={
          scale !== 1
            ? {
                width: `${Math.round(naturalPx * scale)}px`,
                height: `${Math.round(height * scale)}px`,
              }
            : { width: PAPER_WIDTH[paper] }
        }
      >
        <iframe
          ref={ref}
          title={title}
          data-testid={`${testId}-frame`}
          srcDoc={FRAME_HTML}
          sandbox="allow-same-origin allow-modals"
          className="block rounded-[2px] border-0 bg-white shadow-md ring-1 ring-black/5"
          style={{
            width: PAPER_WIDTH[paper],
            height,
            ...(scale !== 1
              ? { transform: `scale(${scale})`, transformOrigin: 'top left' }
              : undefined),
          }}
          onLoad={(event) => {
            const doc = event.currentTarget.contentDocument
            if (!doc) return
            doc.title = title
            doc.documentElement.setAttribute('data-receipt-printing', paper)
            const style = doc.createElement('style')
            const isThermal = paper === '58mm' || paper === '80mm'
            const pageMargin =
              printDocument.page.margins && !isThermal
                ? '0'
                : `${isThermal ? (paper === '58mm' ? 2 : 3) : printDocument.page.margin_mm}mm`
            style.textContent = `${receiptCss}\nhtml,body{margin:0;padding:0;background:white;color:black}body{width:${PAPER_WIDTH[paper]}}@page{size:${isThermal ? `${paper} 297mm` : paper};margin:${pageMargin}} @media print{html,body{width:auto}.receipt-sheet{box-shadow:none!important;margin:0!important}}`
            doc.head.append(style)
            setBody(doc.body)
          }}
        />
      </div>
    </div>
  )
}

export function TemplatePreview({
  config,
  data,
  paper,
  zoom = '100',
  testId = 'receipt-template-preview',
  markOverflow = false,
}: {
  config: TemplateConfig
  data: TemplateData
  paper: PaperSize
  zoom?: PreviewZoom
  testId?: string
  markOverflow?: boolean
}) {
  const { t } = useTranslation('pos')
  const document = useMemo(() => renderDocument(config, data), [config, data])
  return (
    <ReceiptFrame
      key={`${paper}-${Boolean(config.page.margins)}`}
      document={document}
      paper={paper}
      zoom={zoom}
      title={t('receiptTemplates.preview.title')}
      testId={testId}
      markOverflow={markOverflow}
    />
  )
}

export function TemplateThumbnail({
  config,
  data,
  paper,
  title,
  testId,
  maxHeight = 216,
}: {
  config: TemplateConfig
  data: TemplateData
  paper: PaperSize
  title: string
  testId: string
  maxHeight?: number
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')
  const [body, setBody] = useState<HTMLElement | null>(null)
  const scale = THUMB_SCALE[paper]
  const naturalPx = PAPER_MM[paper] * PX_PER_MM
  const scaledWidth = Math.round(naturalPx * scale)
  const unscaledHeight = Math.ceil(maxHeight / scale) + 40

  useEffect(() => {
    const node = wrapperRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting)
      },
      { rootMargin: '320px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const document = useMemo(
    () => (inView ? renderDocument(config, data) : null),
    [inView, config, data],
  )
  const html = useMemo(
    () =>
      document
        ? `<div class="receipt-print-root">${renderSheetHtml(document, { paper, testId })}</div>`
        : '',
    [document, paper, testId],
  )

  useEffect(() => {
    if (!inView) setBody(null)
  }, [inView])

  useEffect(() => {
    if (body && html) body.innerHTML = html
  }, [body, html])

  return (
    <div
      ref={wrapperRef}
      style={{ height: `${maxHeight}px` }}
      className="relative w-full overflow-hidden bg-muted/50 px-3 pt-3"
    >
      {inView && document ? (
        <div className="mx-auto overflow-hidden" style={{ width: `${scaledWidth}px` }}>
          <iframe
            title={title}
            tabIndex={-1}
            aria-hidden="true"
            data-testid={`${testId}-frame`}
            srcDoc={FRAME_HTML}
            sandbox="allow-same-origin"
            className="pointer-events-none block rounded-t-[2px] border-0 bg-white shadow-sm ring-1 ring-black/5"
            style={{
              width: PAPER_WIDTH[paper],
              height: `${unscaledHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            onLoad={(event) => {
              const doc = event.currentTarget.contentDocument
              if (!doc) return
              doc.documentElement.setAttribute('data-receipt-printing', paper)
              const style = doc.createElement('style')
              style.textContent = `${receiptCss}\nhtml,body{margin:0;padding:0;overflow:hidden;background:white;color:black}body{width:${PAPER_WIDTH[paper]}}`
              doc.head.append(style)
              setBody(doc.body)
            }}
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="mx-auto h-full rounded-t-[2px] bg-card/80 shadow-xs ring-1 ring-black/5"
          style={{ width: `${scaledWidth}px` }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/80 to-transparent"
      />
    </div>
  )
}

export function useTestPrint(config: TemplateConfig, data: TemplateData, onFailed: () => void) {
  const [testPrinting, setTestPrinting] = useState(false)
  const testDocument = useMemo(
    () => (testPrinting ? renderDocument(config, data, { testPrint: true }) : null),
    [testPrinting, config, data],
  )
  const printReady = useCallback(
    (frame: HTMLIFrameElement) => {
      try {
        if (!frame.contentWindow) throw new Error('Print frame unavailable')
        frame.contentWindow.focus()
        frame.contentWindow.print()
      } catch {
        onFailed()
      } finally {
        setTestPrinting(false)
      }
    },
    [onFailed],
  )
  return { testPrinting, startTestPrint: () => setTestPrinting(true), testDocument, printReady }
}

export function EditorPreviewCard({
  documentType,
  paper,
  config,
  widthLimit,
  zoom,
  onZoomChange,
  source,
  status,
  latestReceipt,
  branches,
  canReadReceipts,
  registers,
  branchId,
  registerId,
  data,
  hiddenOnMobile,
  onSource,
  onBranch,
  onRegister,
}: {
  documentType: ReceiptDocumentType
  paper: PaperSize
  config: TemplateConfig
  widthLimit: number | null
  zoom: PreviewZoom
  onZoomChange: (zoom: PreviewZoom) => void
  source: PreviewSource
  status: PreviewStatus
  latestReceipt: ReceiptSnapshot | null
  branches: PosBranch[]
  canReadReceipts: boolean
  registers: PosRegister[]
  branchId: string
  registerId: string
  data: TemplateData
  hiddenOnMobile: boolean
  onSource: (source: PreviewSource) => void
  onBranch: (id: string) => void
  onRegister: (id: string) => void
}) {
  const { t } = useTranslation('pos')
  const missingFields = useMemo(
    () => (status === 'latest' ? legacyMissingFields(latestReceipt, config, t) : []),
    [status, latestReceipt, config, t],
  )
  return (
    <ModelCard
      title={t('receiptTemplates.preview.title')}
      id="receipt-preview"
      icon={<EyeIcon />}
      action={<PreviewZoomBar value={zoom} onChange={onZoomChange} />}
      className={`${hiddenOnMobile ? 'hidden lg:flex' : ''} min-w-0 lg:sticky lg:top-4`}
    >
      <div className="grid gap-3">
        <PreviewControls
          documentType={documentType}
          source={source}
          status={status}
          branches={branches}
          canReadReceipts={canReadReceipts}
          registers={registers}
          branchId={branchId}
          registerId={registerId}
          onSource={onSource}
          onBranch={onBranch}
          onRegister={onRegister}
        />
        {missingFields.length > 0 ? (
          <small
            role="status"
            data-testid="legacy-receipt-missing-fields"
            className="rounded-md border border-amber-300/80 bg-amber-50/70 px-2.5 py-1.5 text-amber-900 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {t('receiptTemplates.preview.legacyMissingFields', {
              fields: missingFields.join(', '),
            })}
          </small>
        ) : null}
        {widthLimit !== null ? (
          <small className="text-xs text-muted-foreground">
            {t('receiptTemplates.preview.width', { count: widthLimit, paper })}{' '}
            {t('receiptTemplates.preview.overflow')}
          </small>
        ) : null}
        <TemplatePreview config={config} data={data} paper={paper} zoom={zoom} markOverflow />
      </div>
    </ModelCard>
  )
}
