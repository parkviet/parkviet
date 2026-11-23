import { labelsPerPage } from '@shared/product-label/presets'
import {
  type LabelItem,
  type LabelStoreInfo,
  renderLabels,
} from '@shared/product-label/render'
import { renderLabelsHtml } from '@shared/product-label/render-html'
import type {
  ProductLabelConfig,
  ProductLabelPreset,
  RollLabelPreset,
} from '@shared/product-label/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PreviewZoom } from '../receipt-template/template-preview'

// Shows a laid-out label sheet: the markup `renderLabelsHtml` builds, in a
// frame that runs no scripts, so neither dashboard CSS nor template text can
// reach the page. The sticker sizes are millimetres, so a frame's pixel size
// follows from the stock.

const PX_PER_MM = 96 / 25.4
// Space the preview CSS leaves around each page (body padding, page gap).
const BODY_PADDING_PX = 8
const PAGE_GAP_PX = 12
const FRAME_SANDBOX = 'allow-same-origin allow-modals'

export type LabelPreviewContext = {
  store: LabelStoreInfo | null
  timeZone: string
}

export type LabelPreviewDocument = {
  html: string
  // The frame's natural size in CSS pixels.
  widthPx: number
  heightPx: number
  // Warnings the layout raised for the shown labels, such as `barcode_too_wide`.
  warnings: string[]
}

function pageSizeMm(preset: ProductLabelPreset): { width: number; height: number } {
  return preset.kind === 'roll'
    ? { width: preset.roll_width_mm, height: preset.label_mm.height }
    : preset.sheet_mm
}

// The stock as a row of stickers on a roll: a sheet's thumbnail shows one
// sticker, a roll's shows one row.
export function rowPreset(preset: ProductLabelPreset): RollLabelPreset {
  const columns = preset.kind === 'roll' ? preset.columns : 1
  const used = columns * preset.label_mm.width + (columns - 1) * preset.gap_mm.x
  return {
    kind: 'roll',
    code: preset.code,
    suffix: preset.suffix,
    label_mm: preset.label_mm,
    columns,
    gap_mm: preset.gap_mm,
    compact: preset.compact,
    roll_width_mm: preset.kind === 'roll' ? preset.roll_width_mm : used,
  }
}

function layoutSample(
  config: ProductLabelConfig,
  preset: ProductLabelPreset,
  item: LabelItem,
  context: LabelPreviewContext,
  now: Date,
) {
  return renderLabels(config, preset, [{ ...item, quantity: labelsPerPage(preset) }], {
    now,
    timeZone: context.timeZone,
    store: context.store,
  })
}

// One page of `item` (a roll row or a sheet), as the preview frame shows it.
export function buildLabelPreview(
  config: ProductLabelConfig,
  preset: ProductLabelPreset,
  item: LabelItem,
  context: LabelPreviewContext,
  title: string,
  now: Date = new Date(),
): LabelPreviewDocument {
  const sheet = layoutSample(config, preset, item, context, now)
  const size = pageSizeMm(preset)
  const pages = Math.max(1, sheet.pages.length)
  const warnings = [
    ...new Set(sheet.pages.flatMap((page) => page.cells.flatMap((cell) => cell.label.warnings))),
  ]
  return {
    html: renderLabelsHtml(config, sheet, { title, preview: true }),
    widthPx: Math.ceil(size.width * PX_PER_MM) + BODY_PADDING_PX * 2,
    heightPx:
      Math.ceil(size.height * PX_PER_MM) * pages + PAGE_GAP_PX * pages + BODY_PADDING_PX * 2,
    warnings,
  }
}

// The same page as printable markup, without the preview's gray background.
export function buildLabelPrintHtml(
  config: ProductLabelConfig,
  preset: ProductLabelPreset,
  item: LabelItem,
  context: LabelPreviewContext,
  title: string,
  now: Date = new Date(),
): string {
  return renderLabelsHtml(config, layoutSample(config, preset, item, context, now), { title })
}

// Every page of `items` as the preview frame shows it, and the same pages as
// printable markup. `startCell` leaves the first cells of a sheet empty.
export function buildLabelsDocument(
  config: ProductLabelConfig,
  preset: ProductLabelPreset,
  items: readonly LabelItem[],
  context: LabelPreviewContext,
  title: string,
  startCell: number,
  now: Date = new Date(),
): {
  preview: LabelPreviewDocument
  printHtml: string
  pages: number
  labels: number
  // What the layout found per variant, such as `barcode_too_wide`.
  warningsByVariant: Map<string, string[]>
} {
  const sheet = renderLabels(config, preset, items, {
    now,
    timeZone: context.timeZone,
    store: context.store,
    startCell,
  })
  const size = pageSizeMm(preset)
  const pages = Math.max(1, sheet.pages.length)
  return {
    preview: {
      html: renderLabelsHtml(config, sheet, { title, preview: true }),
      widthPx: Math.ceil(size.width * PX_PER_MM) + BODY_PADDING_PX * 2,
      heightPx:
        Math.ceil(size.height * PX_PER_MM) * pages + PAGE_GAP_PX * pages + BODY_PADDING_PX * 2,
      warnings: [
        ...new Set(
          sheet.pages.flatMap((page) => page.cells.flatMap((cell) => cell.label.warnings)),
        ),
      ],
    },
    printHtml: renderLabelsHtml(config, sheet, { title }),
    pages: sheet.pages.length,
    labels: sheet.labelCount,
    warningsByVariant: new Map(
      sheet.pages.flatMap((page) =>
        page.cells.map((cell) => [cell.label.variantId, cell.label.warnings] as const),
      ),
    ),
  }
}

// A sticker's content is taller than the sticker: its rows are clipped at
// the sticker's edge. Rows can shrink, so each row's own content height
// is what counts.
export function labelsOverflow(doc: Document): boolean {
  for (const label of doc.querySelectorAll<HTMLElement>('.label')) {
    // Not laid out (the frame is hidden): there is nothing to measure.
    if (label.clientHeight === 0) continue
    const style = doc.defaultView?.getComputedStyle(label)
    const padding = style
      ? Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
      : 0
    const content = Array.from(label.children).reduce(
      (sum, row) => sum + (row as HTMLElement).scrollHeight,
      0,
    )
    if (content > label.clientHeight - padding + 0.5) return true
  }
  return false
}

export function LabelFrame({
  document: preview,
  title,
  testId,
  zoom = 'fit',
  maxScale = 4,
  maxHeightPx,
  onMeasured,
}: {
  document: LabelPreviewDocument
  title: string
  testId: string
  zoom?: PreviewZoom
  maxScale?: number
  // Crops the frame to this height (card thumbnails).
  maxHeightPx?: number
  onMeasured?: (overflow: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const measuredRef = useRef(onMeasured)
  measuredRef.current = onMeasured

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (doc && frameRef.current?.clientWidth) measuredRef.current?.(labelsOverflow(doc))
  }, [])

  // A frame that loads while hidden is measured once it is shown.
  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const measure = () => setContainerWidth(node.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [])

  const scale =
    zoom === '75'
      ? 0.75
      : zoom === 'fit' && containerWidth > 0
        ? Math.min(maxScale, Math.max(0.2, containerWidth / preview.widthPx))
        : 1
  const scaledWidth = Math.round(preview.widthPx * scale)
  const scaledHeight = Math.round(preview.heightPx * scale)

  return (
    <div
      ref={containerRef}
      data-zoom={zoom}
      className="max-w-full overflow-auto"
      style={maxHeightPx ? { maxHeight: maxHeightPx } : undefined}
    >
      <div className="mx-auto overflow-hidden" style={{ width: scaledWidth, height: scaledHeight }}>
        <iframe
          ref={frameRef}
          title={title}
          data-testid={`${testId}-frame`}
          data-paper-width={preview.widthPx}
          srcDoc={preview.html}
          sandbox={FRAME_SANDBOX}
          tabIndex={-1}
          className="pointer-events-none block border-0 bg-white"
          style={{
            width: preview.widthPx,
            height: preview.heightPx,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          onLoad={measure}
        />
      </div>
    </div>
  )
}

// Prints a label sheet through the browser: the frame is kept off screen
// and prints once its fonts are ready.
export function useLabelPrint(onFailed: () => void) {
  const [html, setHtml] = useState<string | null>(null)
  const done = useRef(false)

  const start = useCallback((markup: string) => {
    done.current = false
    setHtml(markup)
  }, [])

  const ready = useCallback(
    async (frame: HTMLIFrameElement) => {
      if (done.current) return
      done.current = true
      try {
        const win = frame.contentWindow
        if (!win) throw new Error('Print frame unavailable')
        await frame.contentDocument?.fonts.ready
        win.focus()
        win.print()
      } catch {
        onFailed()
      } finally {
        setHtml(null)
      }
    },
    [onFailed],
  )

  const frame = useMemo(
    () =>
      html ? (
        <iframe
          title="label-print"
          data-testid="product-label-test-print-frame"
          srcDoc={html}
          sandbox={FRAME_SANDBOX}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none fixed -left-[10000px] top-0 h-[1200px] w-[900px] border-0"
          onLoad={(event) => void ready(event.currentTarget)}
        />
      ) : null,
    [html, ready],
  )

  return { printing: html !== null, start, frame }
}
