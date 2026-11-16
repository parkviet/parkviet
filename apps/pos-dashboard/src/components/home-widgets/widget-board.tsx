import { GripVerticalIcon, MinusIcon } from '@spree/dashboard-ui/icons'
import { type ReactNode, type Ref, useMemo } from 'react'
import GridLayout, { getCompactor, type Layout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useTranslation } from 'react-i18next'
import {
  applyPositions,
  type DashboardLayout,
  type DashboardLayoutItem,
  GRID_COLUMNS,
  GRID_MARGIN,
  GRID_ROW_HEIGHT,
  packUpward,
  readingOrder,
} from '../../lib/dashboard-layout'
import type { WidgetContext, WidgetDefinition } from './registry'
import { WidgetBoundary } from './widget-card'

// Below this content width the widgets stack in one column and cannot be
// moved; a tablet beside the sidebar keeps the grid.
const NARROW_WIDTH = 480
const DRAG_HANDLE = 'home-widget-drag'
// Items stay where they are stored, so a widget hidden at this branch keeps
// its slot; a drag or resize into another item is refused.
const freePlacement = getCompactor(null, false, true)

type Shown = { item: DashboardLayoutItem; definition: WidgetDefinition }

// The home widgets on a 12-column grid. Read-only unless `editing`; while
// editing, a widget moves by its grip, resizes from its bottom-right corner
// and is hidden with its minus button. Widgets that do not apply at the branch
// show as empty slots while editing, so nothing is moved onto them.
export function WidgetBoard({
  layout,
  definitionOf,
  placeholderOf,
  context,
  label,
  editing,
  onLayoutChange,
  onHide,
  onOptionsChange,
  renderHint,
}: {
  layout: DashboardLayout
  // The widget's definition when the reader may see it at this branch.
  definitionOf: (item: DashboardLayoutItem) => WidgetDefinition | undefined
  // A known widget the reader may not see at this branch.
  placeholderOf: (item: DashboardLayoutItem) => WidgetDefinition | undefined
  context: WidgetContext
  label: string
  editing: boolean
  onLayoutChange: (layout: DashboardLayout) => void
  onHide: (id: string) => void
  // A widget changed its own choices (a selected tab).
  onOptionsChange: (id: string, options: Record<string, unknown>) => void
  // Editing guidance above the widgets, worded for the grid or the column.
  renderHint?: (narrow: boolean) => ReactNode
}) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true })
  const narrow = width < NARROW_WIDTH
  const shown = useMemo(() => {
    const visible = layout.flatMap((item): Shown[] => {
      const definition = definitionOf(item)
      return definition ? [{ item, definition }] : []
    })
    // Editing shows the stored positions; reading closes the rows left empty
    // by widgets hidden at this branch. The packed positions are never saved.
    const placed = editing ? readingOrder(layout) : packUpward(visible.map(({ item }) => item))
    const byId = new Map(visible.map((entry) => [entry.item.id, entry.definition]))
    return placed.flatMap((item): Shown[] => {
      const definition = byId.get(item.id)
      return definition ? [{ item, definition }] : []
    })
  }, [layout, definitionOf, editing])
  const slots = useMemo(
    () =>
      editing
        ? layout.flatMap((item): Shown[] => {
            const definition = placeholderOf(item)
            return definition ? [{ item, definition }] : []
          })
        : [],
    [editing, layout, placeholderOf],
  )
  const gridLayout = useMemo<Layout>(
    () => [
      ...shown.map(({ item, definition: { size } }) => ({
        i: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: size.minW,
        minH: size.minH,
        maxW: size.maxW,
        maxH: size.maxH,
      })),
      ...slots.map(({ item }) => ({ ...gridBox(item), static: true, isResizable: false })),
    ],
    [shown, slots],
  )
  const cell = (entry: Shown) => (
    <WidgetCell
      entry={entry}
      context={context}
      editing={editing}
      movable={editing && !narrow}
      onHide={onHide}
      onOptionsChange={onOptionsChange}
    />
  )
  return (
    <div
      ref={containerRef}
      className="home-widget-board flex flex-col gap-4"
      data-editing={editing || undefined}
    >
      {mounted && renderHint?.(narrow)}
      {!mounted ? null : narrow ? (
        <ul className="flex flex-col gap-4" aria-label={label}>
          {shown.map((entry) => (
            <li key={entry.item.id} className="relative">
              {cell(entry)}
            </li>
          ))}
        </ul>
      ) : (
        // The grid library renders its own container between the list and its
        // items, so the list semantics are given by role.
        // biome-ignore lint/a11y/useSemanticElements: a <ul> cannot hold the grid's <div>
        <div role="list" aria-label={label}>
          <GridLayout
            width={width}
            layout={gridLayout}
            compactor={freePlacement}
            gridConfig={{
              cols: GRID_COLUMNS,
              rowHeight: GRID_ROW_HEIGHT,
              margin: [GRID_MARGIN, GRID_MARGIN],
              containerPadding: [0, 0],
            }}
            dragConfig={{ enabled: editing, handle: `.${DRAG_HANDLE}` }}
            resizeConfig={{
              enabled: editing,
              // No corner is drawn while reading.
              handles: editing ? ['se'] : [],
              handleComponent: resizeHandle,
            }}
            onLayoutChange={(next) => {
              if (editing) onLayoutChange(applyPositions(layout, next))
            }}
          >
            {shown.map((entry) => (
              // biome-ignore lint/a11y/useSemanticElements: an item of the role list above
              <div key={entry.item.id} role="listitem">
                {cell(entry)}
              </div>
            ))}
            {slots.map((entry) => (
              // biome-ignore lint/a11y/useSemanticElements: an item of the role list above
              <div key={entry.item.id} role="listitem">
                <SlotCell entry={entry} onHide={onHide} />
              </div>
            ))}
          </GridLayout>
        </div>
      )}
    </div>
  )
}

const gridBox = ({ id, x, y, w, h }: DashboardLayoutItem) => ({ i: id, x, y, w, h })

function resizeHandle(_axis: string, ref: Ref<HTMLElement>) {
  return (
    <span
      ref={ref as Ref<HTMLSpanElement>}
      aria-hidden
      className="absolute right-1 bottom-1 z-10 size-4 cursor-se-resize rounded-br-md border-r-2 border-b-2 border-muted-foreground/60 hover:border-primary"
    />
  )
}

function WidgetCell({
  entry: { item, definition },
  context,
  editing,
  movable,
  onHide,
  onOptionsChange,
}: {
  entry: Shown
  context: WidgetContext
  editing: boolean
  movable: boolean
  onHide: (id: string) => void
  onOptionsChange: (id: string, options: Record<string, unknown>) => void
}) {
  const { t } = useTranslation()
  const name = t(definition.titleKey)
  return (
    <div
      className={['group/widget relative h-full', editing ? 'select-none' : ''].join(' ')}
      data-editing={movable || undefined}
    >
      {/* While editing, the widget body is not interactive: its links would
          leave the page and lose the draft. */}
      <div className="h-full" inert={editing}>
        <WidgetBoundary key={context.branchId}>
          {definition.render({
            context,
            titleId: item.id,
            options: item.options ?? {},
            setOptions: (options) => onOptionsChange(item.id, options),
          })}
        </WidgetBoundary>
      </div>
      {editing && (
        <>
          <HideButton id={item.id} name={name} onHide={onHide} />
          {movable && (
            <span
              className={`${DRAG_HANDLE} absolute top-0.5 left-1/2 z-10 flex h-5 w-10 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing`}
              title={t('homeWidgets.move', { name })}
              aria-hidden
            >
              <GripVerticalIcon className="size-4 rotate-90" />
            </span>
          )}
        </>
      )}
    </div>
  )
}

function HideButton({
  id,
  name,
  onHide,
}: {
  id: string
  name: string
  onHide: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className="absolute -top-2 -left-2 z-10 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={t('homeWidgets.hide', { name })}
      title={t('homeWidgets.hide', { name })}
      onClick={() => onHide(id)}
    >
      <MinusIcon className="size-4" />
    </button>
  )
}

// The slot of a widget that does not apply at the selected branch.
function SlotCell({
  entry: { item, definition },
  onHide,
}: {
  entry: Shown
  onHide: (id: string) => void
}) {
  const { t } = useTranslation()
  const name = t(definition.titleKey)
  return (
    <div className="relative h-full select-none">
      <div className="flex h-full flex-col justify-center gap-1 overflow-hidden rounded-card border border-dashed p-4 text-sm text-muted-foreground">
        <p className="truncate font-medium">{name}</p>
        <p className="line-clamp-2">{t('homeWidgets.otherBranch')}</p>
      </div>
      <HideButton id={item.id} name={name} onHide={onHide} />
    </div>
  )
}
