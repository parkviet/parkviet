import { cutoffHour, type DayRange, overviewRequestRange } from '@shared/overview'
import { businessDate } from '@shared/reports'
import { describeFailure } from '@shared/request-failure'
import { PageHeader, usePermissions } from '@spree/dashboard-core'
import { Button, toastManager, useConfirm } from '@spree/dashboard-ui'
import { InfoIcon, PlusIcon, SlidersHorizontalIcon, XIcon } from '@spree/dashboard-ui/icons'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { AddWidgetSheet } from '../components/home-widgets/add-widget-sheet'
import { PeriodFilter } from '../components/home-widgets/period-filter'
import {
  HOME_DEFAULT_WIDGETS,
  HOME_WIDGET_SIZES,
  HOME_WIDGETS,
  homeWidget,
  type WidgetContext,
  type WidgetDefinition,
} from '../components/home-widgets/registry'
import { WidgetBoard } from '../components/home-widgets/widget-board'
import { PageSkeleton } from '../components/page-skeleton'
import { useDashboardLayout } from '../hooks/use-dashboard-layout'
import { type OverviewPeriod, useOverview } from '../hooks/use-overview'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  type DashboardLayout,
  type DashboardLayoutItem,
  missingWidgets,
  placeWidget,
  sameLayout,
} from '../lib/dashboard-layout'
import { branchTimeZone } from '../lib/format-time'
import { canReadReports, type PosAccess } from '../lib/pos-access'
import { homeSearchSchema } from '../schemas/home-search'

const NO_OPTIONS: Record<string, Record<string, unknown>> = {}

// The home page: widgets for the selected branch, limited to what the
// reader's branch capabilities let them see. The reader arranges them;
// changes stay in a draft until confirmed.
export function HomePage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { storeId } = useSession()
  const { permissionKeys } = usePermissions()
  const { context } = usePosSession()
  const data = context.data
  const branchId = data?.selection.branch_id ?? null
  const access = useMemo<PosAccess>(
    () => ({ permissionKeys, context: data }),
    [permissionKeys, data],
  )
  const stored = useDashboardLayout(storeId, HOME_WIDGET_SIZES, HOME_DEFAULT_WIDGETS)
  const navigate = useNavigate()
  const search = homeSearchSchema.parse(useSearch({ strict: false }))
  // Sales belong to business days: "today" is the branch's business day.
  const branch = data?.branches.find((row) => row.id === branchId)
  const cutoff = branch?.business_day_cutoff ?? '04:00'
  const today = businessDate(branchTimeZone(data), cutoff)
  const { range, valid: rangeValid } = overviewRequestRange(search, today)
  const compare = search.compare !== false
  const period = useMemo<OverviewPeriod | null>(
    () => (rangeValid ? { from: range.from, to: range.to, compare } : null),
    [rangeValid, range.from, range.to, compare],
  )
  const readsSales = canReadReports(access)
  // The draft belongs to the store it was made in; opening another store
  // drops it.
  const [edit, setEdit] = useState<{ storeId: string; layout: DashboardLayout } | null>(null)
  const draft = edit?.storeId === storeId ? edit.layout : null
  const setDraft = useCallback(
    (layout: DashboardLayout | null) => setEdit(layout ? { storeId, layout } : null),
    [storeId],
  )
  const [hintOpen, setHintOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  // Choices made in widgets (a selected tab) while the reader follows the
  // default layout: kept for this visit only, so storing them does not tie
  // the reader to today's default.
  const [visit, setVisit] = useState<{
    storeId: string
    options: Record<string, Record<string, unknown>>
  }>({ storeId, options: {} })
  const visitOptions = visit.storeId === storeId ? visit.options : NO_OPTIONS
  const viewed = useMemo(
    () =>
      stored.layout.map((item) =>
        visitOptions[item.id] ? { ...item, options: visitOptions[item.id] } : item,
      ),
    [stored.layout, visitOptions],
  )
  const editing = draft !== null
  const layout = draft ?? viewed
  // The overview is asked for only while a widget on the page reads it; the
  // same query feeds the widgets and tells which have nothing to show here.
  const readsOverview = layout.some((item) => {
    const definition = homeWidget(item.widget)
    return Boolean(definition?.usesOverview && definition.visible(access))
  })
  const overview = useOverview(branchId ?? '', period, readsOverview && Boolean(branchId))

  const loaded = overview.data
  const applies = useCallback(
    (definition: WidgetDefinition) =>
      definition.visible(access) && !(loaded && definition.unavailable?.(loaded)),
    [access, loaded],
  )
  const available = useMemo(() => HOME_WIDGETS.filter(applies), [applies])
  const definitionOf = useCallback(
    (item: DashboardLayoutItem) => {
      const definition = homeWidget(item.widget)
      return definition && applies(definition) ? definition : undefined
    },
    [applies],
  )
  const placeholderOf = useCallback(
    (item: DashboardLayoutItem) => {
      const definition = homeWidget(item.widget)
      return definition && !applies(definition) ? definition : undefined
    },
    [applies],
  )
  const missing = new Set(missingWidgets(layout, HOME_WIDGET_SIZES))
  const addable = available.filter((definition) => missing.has(definition.widget))
  const shownCount = layout.filter((item) => definitionOf(item)).length

  function startEditing(from: DashboardLayout = viewed) {
    setHintOpen(true)
    setDraft(from)
  }
  function addWidget(widget: string) {
    const definition = homeWidget(widget)
    if (!definition) return
    // Adding from the read-only page opens the editor with the widget placed,
    // so the reader can move it before confirming.
    const next = placeWidget(layout, widget, definition.size)
    if (editing) setDraft(next)
    else startEditing(next)
    setAdding(false)
  }
  async function resetDraft() {
    const accepted = await confirm({
      title: t('homeWidgets.resetTitle'),
      message: t('homeWidgets.resetConfirm'),
      confirmLabel: t('homeWidgets.reset'),
      cancelLabel: t('adminCancel'),
      variant: 'destructive',
    })
    if (accepted) setDraft(stored.defaults)
  }
  function changePeriod(patch: { from?: string; to?: string; compare?: boolean }) {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch }),
      replace: true,
    })
  }
  function changeRange(next: DayRange | null) {
    changePeriod({ from: next?.from, to: next?.to })
  }
  const saveFailed = (error: unknown) =>
    toastManager.add({
      type: 'error',
      title: t('homeWidgets.saveFailed'),
      description: describeFailure(error, t),
    })
  // A widget's own choice (a selected tab) is part of its layout item: kept
  // in the draft while editing, saved with a stored layout, and kept for the
  // visit while the reader follows the default.
  async function changeOptions(id: string, options: Record<string, unknown>) {
    const withOptions = (from: DashboardLayout) =>
      from.map((item) => (item.id === id ? { ...item, options } : item))
    if (draft) {
      setDraft(withOptions(draft))
      return
    }
    setVisit({ storeId, options: { ...visitOptions, [id]: options } })
    if (!stored.customized) return
    try {
      await stored.save(withOptions(stored.layout))
    } catch (error) {
      saveFailed(error)
    }
  }
  async function saveDraft() {
    if (!draft || saving) return
    setSaving(true)
    try {
      // The default layout is not stored, so later registry defaults reach it.
      if (sameLayout(draft, stored.defaults)) {
        await stored.reset()
        setVisit({ storeId, options: {} })
      } else await stored.save(draft)
      setDraft(null)
    } catch (error) {
      // The draft stays open so the reader can try again.
      saveFailed(error)
    } finally {
      setSaving(false)
    }
  }

  const ready =
    !context.isPending && !context.isError && Boolean(branchId) && !stored.pending && !stored.error
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <BranchPicker />
      {ready && available.length > 0 && (
        <>
          {!editing && (
            <Button type="button" variant="outline" onClick={() => startEditing()}>
              <SlidersHorizontalIcon />
              {t('homeWidgets.customize')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <PlusIcon />
            {t('homeWidgets.addWidget')}
          </Button>
        </>
      )}
    </div>
  )
  const widgetContext: WidgetContext | null = branchId
    ? {
        storeId,
        branchId,
        staffId: data?.staff.id ?? null,
        shiftId: data?.shift?.id ?? null,
        period,
        today,
        currency: data?.store.currency ?? 'VND',
        dayStartHour: cutoffHour(cutoff),
      }
    : null

  return (
    <div className="space-y-6">
      <PageHeader title={t('homeWidgets.title')} actions={actions} />
      {context.isPending || stored.pending ? (
        // The reader's own layout is awaited, so the default never flashes first.
        <PageSkeleton variant="cards" />
      ) : context.isError ? (
        <div role="alert">
          {describeFailure(context.error, t)}
          <Button onClick={() => void context.refetch()}>{t('retry')}</Button>
        </div>
      ) : stored.error ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">
            {t('homeWidgets.loadFailed')} {describeFailure(stored.error, t)}
          </p>
          <Button variant="outline" onClick={stored.retry}>
            {t('retry')}
          </Button>
        </div>
      ) : !widgetContext ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : available.length === 0 ? (
        <p className="text-muted-foreground">{t('attention.nothing')}</p>
      ) : (
        <>
          {readsSales && readsOverview && !editing && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <PeriodFilter
                range={range}
                today={today}
                compare={compare}
                invalid={!rangeValid}
                onRangeChange={changeRange}
                onCompareChange={(next) => changePeriod({ compare: next ? undefined : false })}
              />
              {overview.data?.scope === 'own' && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t('reportScopeOwn')}
                </p>
              )}
            </div>
          )}
          {shownCount === 0 ? (
            <p className="text-muted-foreground">{t('homeWidgets.empty')}</p>
          ) : (
            <WidgetBoard
              layout={layout}
              definitionOf={definitionOf}
              placeholderOf={placeholderOf}
              context={widgetContext}
              label={t('homeWidgets.title')}
              editing={editing}
              onLayoutChange={setDraft}
              onHide={(id) => setDraft(layout.filter((item) => item.id !== id))}
              onOptionsChange={(id, options) => void changeOptions(id, options)}
              renderHint={(narrow) =>
                editing &&
                hintOpen && (
                  <div
                    role="note"
                    className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
                  >
                    <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p className="flex-1">
                      {t(narrow ? 'homeWidgets.editHintNarrow' : 'homeWidgets.editHint')}
                    </p>
                    <button
                      type="button"
                      className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={t('homeWidgets.dismissHint')}
                      onClick={() => setHintOpen(false)}
                    >
                      <XIcon className="size-4" />
                    </button>
                  </div>
                )
              }
            />
          )}
          {editing && (
            <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => void resetDraft()}
              >
                {t('homeWidgets.reset')}
              </Button>
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setDraft(null)}
                >
                  {t('homeWidgets.cancel')}
                </Button>
                <Button type="button" disabled={saving} onClick={() => void saveDraft()}>
                  {t('homeWidgets.confirm')}
                </Button>
              </div>
            </div>
          )}
          <AddWidgetSheet
            open={adding}
            widgets={addable}
            onOpenChange={setAdding}
            onAdd={addWidget}
          />
        </>
      )}
    </div>
  )
}
