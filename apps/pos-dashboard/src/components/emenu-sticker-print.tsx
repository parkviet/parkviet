import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { Button, useConfirm } from '@spree/dashboard-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { EmenuSettings } from '../hooks/use-emenu'
import { useAreas, useFloorPlanWrite, useTableCodes } from '../hooks/use-floor-plan'
import { StickerFace, stickerWidthMm } from './emenu-preview'
import { ModelNotice } from './setup/model-ui'

type Printed = { name: string; url: string }

export function formatAreaTable(area: string | undefined, tableName: string) {
  return area ? `${area} – ${tableName}` : tableName
}

// Prints the chosen tables' stickers on A4 paper from the browser, at the
// sticker width. Each sticker needs a new code: the old sticker of that
// table, and every phone that scanned it, stop working.
export function StickerPrintPanel({
  branchId,
  write,
  settings,
}: {
  branchId: string
  write: boolean
  settings: EmenuSettings
}) {
  const { t } = useTranslation()
  const codes = useTableCodes(branchId, true)
  const areas = useAreas(branchId)
  const mutation = useFloorPlanWrite()
  const confirm = useConfirm()
  const [chosen, setChosen] = useState<string[]>([])
  const [sheet, setSheet] = useState<Printed[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const areaNames = useMemo(
    () => new Map((areas.data ?? []).map((area) => [area.id, area.name])),
    [areas.data],
  )
  const tables = codes.data ?? []
  const all = tables.length > 0 && chosen.length === tables.length

  const print = async () => {
    const picked = tables.filter((row) => chosen.includes(row.resource_id))
    const replaced = picked.filter((row) => row.table_code).length
    if (
      replaced > 0 &&
      !(await confirm({
        message: t('emenu.paperConfirm', { count: replaced }),
        variant: 'destructive',
        confirmLabel: t('emenu.paperPrint'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setBusy(true)
    setNotice(null)
    const done: Printed[] = []
    const issuedIds = new Set<string>()
    try {
      for (const row of picked) {
        const response = (await mutation.mutateAsync({
          method: 'POST',
          path: '/pos/table_codes',
          body: { resource_id: row.resource_id },
        })) as { meta?: { url?: unknown } }
        const url = response.meta?.url
        if (typeof url === 'string') {
          done.push({
            name: formatAreaTable(areaNames.get(row.area_id), row.name),
            url,
          })
          issuedIds.add(row.resource_id)
        }
      }
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    } finally {
      setBusy(false)
    }
    if (done.length > 0) {
      setSheet(done)
      setChosen((previous) => previous.filter((id) => !issuedIds.has(id)))
      if (done.length === picked.length) {
        setNotice({ text: t('emenu.paperIssued', { count: done.length }), failed: false })
      }
    }
  }

  if (!write) return null
  return (
    <section className="space-y-3 border-t pt-4" aria-label={t('emenu.paperTitle')}>
      <div>
        <h4 className="text-sm font-semibold">{t('emenu.paperTitle')}</h4>
        <p className="text-sm text-muted-foreground">
          {t('emenu.paperHint', { width: stickerWidthMm(settings) })}
        </p>
      </div>
      {codes.error ? (
        <p className="text-sm text-destructive">{describeFailure(codes.error, t)}</p>
      ) : tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {codes.isPending ? t('waiting') : t('floorPlan.qrNoTables')}
        </p>
      ) : (
        <div className="rounded-md border">
          <label className="flex items-center gap-3 border-b px-3 py-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={all}
              onChange={() => setChosen(all ? [] : tables.map((row) => row.resource_id))}
            />
            {t('emenu.paperAll', { count: tables.length })}
          </label>
          <ul className="grid max-h-56 gap-x-4 overflow-y-auto px-3 py-2 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((row) => {
              const label = formatAreaTable(areaNames.get(row.area_id), row.name)
              return (
                <li key={row.resource_id}>
                  <label className="flex items-center gap-3 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={chosen.includes(row.resource_id)}
                      onChange={(event) =>
                        setChosen(
                          event.target.checked
                            ? [...chosen, row.resource_id]
                            : chosen.filter((id) => id !== row.resource_id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {row.table_code ? (
                      <span className="text-xs text-muted-foreground">
                        {t('emenu.paperHasCode')}
                      </span>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <ModelNotice notice={notice} />
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy || chosen.length === 0} onClick={() => void print()}>
          {busy ? t('waiting') : t('emenu.paperPrintCount', { count: chosen.length })}
        </Button>
        {sheet.length > 0 && !busy ? (
          <Button type="button" variant="outline" onClick={() => void printSheet()}>
            {t('emenu.paperReprint', { count: sheet.length })}
          </Button>
        ) : null}
      </div>
      {sheet.length > 0 ? <PrintSheet settings={settings} sheet={sheet} /> : null}
    </section>
  )
}

const SHEET_ID = 'emenu-sticker-sheet'

// Opens the print dialog once the sheet's pictures have loaded.
async function printSheet() {
  const images = [...document.querySelectorAll<HTMLImageElement>(`#${SHEET_ID} img`)]
  await Promise.race([
    Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true })
              image.addEventListener('error', resolve, { once: true })
            }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
  window.print()
}

// Hidden on screen; when printing, the only thing on the page.
function PrintSheet({ settings, sheet }: { settings: EmenuSettings; sheet: Printed[] }) {
  const width = `${stickerWidthMm(settings)}mm`
  // Once per new sheet, even when development mode runs effects twice.
  const printed = useRef<Printed[] | null>(null)
  useEffect(() => {
    if (printed.current === sheet) return
    printed.current = sheet
    void printSheet()
  }, [sheet])
  return createPortal(
    <div id={SHEET_ID} data-testid="emenu-print-sheet">
      <style>{`
        #${SHEET_ID} { display: none; }
        @media print {
          @page { size: A4; margin: 10mm; }
          body > *:not(#${SHEET_ID}) { display: none !important; }
          #${SHEET_ID} { display: flex; flex-wrap: wrap; gap: 6mm; align-items: flex-start; }
          #${SHEET_ID} > div { outline: 0.2mm dashed #999; }
        }
      `}</style>
      {sheet.map((row) => (
        <StickerFace
          key={row.url}
          settings={settings}
          tableName={row.name}
          url={row.url}
          width={width}
        />
      ))}
    </div>,
    document.body,
  )
}
