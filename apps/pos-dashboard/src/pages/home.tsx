import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { PageHeader, usePermissions } from '@spree/dashboard-core'
import { Button, useConfirm } from '@spree/dashboard-ui'
import { InfoIcon, PlusIcon, SlidersHorizontalIcon, XIcon } from '@spree/dashboard-ui/icons'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { AddWidgetSheet } from '../components/home-widgets/add-widget-sheet'
import {
  HOME_WIDGET_SIZES,
  HOME_WIDGETS,
  homeWidget,
  type WidgetContext,
} from '../components/home-widgets/registry'
import { WidgetBoard } from '../components/home-widgets/widget-board'
import { PageSkeleton } from '../components/page-skeleton'
import { useDashboardLayout } from '../hooks/use-dashboard-layout'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  type DashboardLayout,
  type DashboardLayoutItem,
  missingWidgets,
  placeWidget,
  sameLayout,
} from '../lib/dashboard-layout'
import type { PosAccess } from '../lib/pos-access'

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
  const stored = useDashboardLayout(storeId, HOME_WIDGET_SIZES)
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
  const [failure, setFailure] = useState<string | null>(null)
  const editing = draft !== null
  const layout = draft ?? stored.layout

  const available = useMemo(
    () => HOME_WIDGETS.filter((definition) => definition.visible(access)),
    [access],
  )
  const definitionOf = useCallback(
    (item: DashboardLayoutItem) => {
      const definition = homeWidget(item.widget)
      return definition?.visible(access) ? definition : undefined
    },
    [access],
  )
  const placeholderOf = useCallback(
    (item: DashboardLayoutItem) => {
      const definition = homeWidget(item.widget)
      return definition && !definition.visible(access) ? definition : undefined
    },
    [access],
  )
  const missing = new Set(missingWidgets(layout, HOME_WIDGET_SIZES))
  const addable = available.filter((definition) => missing.has(definition.widget))
  const shownCount = layout.filter((item) => definitionOf(item)).length

  function startEditing(from: DashboardLayout = stored.layout) {
    setFailure(null)
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
  async function saveDraft() {
    if (!draft || saving) return
    setSaving(true)
    setFailure(null)
    try {
      // The default layout is not stored, so later registry defaults reach it.
      if (sameLayout(draft, stored.defaults)) await stored.reset()
      else await stored.save(draft)
      setDraft(null)
    } catch (error) {
      setFailure(describeFailure(error, t, 'homeWidgets.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const ready = !context.isPending && !context.isError && Boolean(branchId)
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
      }
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attention.title')}
        description={t('attention.hint')}
        actions={actions}
      />
      {context.isPending ? (
        <PageSkeleton variant="cards" />
      ) : context.isError ? (
        <div role="alert">
          {describeFailure(context.error, t)}
          <Button onClick={() => void context.refetch()}>{t('retry')}</Button>
        </div>
      ) : !widgetContext ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : available.length === 0 ? (
        <p className="text-muted-foreground">{t('attention.nothing')}</p>
      ) : (
        <>
          {shownCount === 0 ? (
            <p className="text-muted-foreground">{t('homeWidgets.empty')}</p>
          ) : (
            <WidgetBoard
              layout={layout}
              definitionOf={definitionOf}
              placeholderOf={placeholderOf}
              context={widgetContext}
              label={t('attention.title')}
              editing={editing}
              onLayoutChange={setDraft}
              onHide={(id) => setDraft(layout.filter((item) => item.id !== id))}
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
              {failure && (
                <p role="alert" className="w-full text-sm text-destructive">
                  {failure}
                </p>
              )}
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
                  onClick={() => {
                    setFailure(null)
                    setDraft(null)
                  }}
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
