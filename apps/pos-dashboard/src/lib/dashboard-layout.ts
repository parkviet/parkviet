// The home page's widget layout: pure placement rules shared by the grid, the
// "add widget" sheet and the layout storage. Coordinates are grid units on a
// 12-column grid; rows have no upper bound.

export const GRID_COLUMNS = 12
export const GRID_ROW_HEIGHT = 64
export const GRID_MARGIN = 8
// A stored layout longer than this is not something the page produced.
export const MAX_LAYOUT_ITEMS = 60

export type WidgetSize = {
  w: number
  h: number
  minW: number
  minH: number
  maxW: number
  maxH: number
}

// Sizes of every widget the page knows, in registry order.
export type WidgetSizes = Readonly<Record<string, WidgetSize>>

export type DashboardLayoutItem = {
  id: string
  widget: string
  x: number
  y: number
  w: number
  h: number
  options?: Record<string, unknown>
}

export type DashboardLayout = readonly DashboardLayoutItem[]

type Box = { x: number; y: number; w: number; h: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Keeps an item inside the grid and inside its widget's size limits.
export function clampItem(
  item: DashboardLayoutItem,
  size: WidgetSize,
  cols = GRID_COLUMNS,
): DashboardLayoutItem {
  const w = clamp(Math.round(item.w), Math.min(size.minW, cols), Math.min(size.maxW, cols))
  const h = clamp(Math.round(item.h), size.minH, size.maxH)
  const x = clamp(Math.round(item.x), 0, cols - w)
  const y = Math.max(0, Math.round(item.y))
  return { ...item, x, y, w, h }
}

export const collides = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

// The top-most, then left-most cell where a w×h box overlaps nothing. Pass
// every item of the layout, including widgets hidden at the selected branch,
// so their slots stay free.
export function firstFreeSpot(
  layout: readonly Box[],
  w: number,
  h: number,
  cols = GRID_COLUMNS,
): { x: number; y: number } {
  const width = Math.min(w, cols)
  const bottom = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + width <= cols; x++) {
      const box = { x, y, w: width, h }
      if (!layout.some((item) => collides(box, item))) return { x, y }
    }
  }
  return { x: 0, y: bottom }
}

// Adds a widget at its default size in the first free spot. An id already in
// the layout gets a numeric suffix, so a layout never holds two equal ids.
export function placeWidget(
  layout: DashboardLayout,
  widget: string,
  size: WidgetSize,
  cols = GRID_COLUMNS,
): DashboardLayout {
  const ids = new Set(layout.map((item) => item.id))
  let id = widget
  for (let n = 2; ids.has(id); n++) id = `${widget}-${n}`
  const w = Math.min(size.w, cols)
  const spot = firstFreeSpot(layout, w, size.h, cols)
  return [...layout, { id, widget, ...spot, w, h: size.h }]
}

export function defaultLayout(sizes: WidgetSizes, cols = GRID_COLUMNS): DashboardLayout {
  return Object.entries(sizes).reduce<DashboardLayout>(
    (layout, [widget, size]) => placeWidget(layout, widget, size, cols),
    [],
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

// Moves an item down, keeping its column, until it overlaps none of `placed`.
function belowCollisions(item: DashboardLayoutItem, placed: readonly Box[]): DashboardLayoutItem {
  let y = item.y
  for (;;) {
    const hit = placed.find((other) => collides({ ...item, y }, other))
    if (!hit) return y === item.y ? item : { ...item, y }
    y = hit.y + hit.h
  }
}

// Reads a stored layout against the widgets the page knows: entries of
// unknown widgets, malformed entries and repeated ids are dropped, sizes are
// clamped, and an item overlapping an earlier one is pushed down below it
// (the grid places items as stored, without compaction). Returns null when the value is not a layout at all, so the caller
// falls back to the default; an empty array is a layout with every widget off.
export function mergeLayout(
  saved: unknown,
  sizes: WidgetSizes,
  cols = GRID_COLUMNS,
): DashboardLayout | null {
  if (!Array.isArray(saved)) return null
  const seen = new Set<string>()
  const layout: DashboardLayoutItem[] = []
  for (const entry of saved.slice(0, MAX_LAYOUT_ITEMS)) {
    if (!isRecord(entry)) continue
    const { id, widget, x, y, w, h, options } = entry
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue
    if (typeof widget !== 'string' || !Object.hasOwn(sizes, widget)) continue
    if (![x, y, w, h].every(isCoordinate)) continue
    seen.add(id)
    const item: DashboardLayoutItem = {
      id,
      widget,
      x: x as number,
      y: y as number,
      w: w as number,
      h: h as number,
    }
    if (isRecord(options)) item.options = options
    layout.push(belowCollisions(clampItem(item, sizes[widget], cols), layout))
  }
  return layout
}

// Registry widgets with no item in the layout, in registry order.
export function missingWidgets(layout: DashboardLayout, sizes: WidgetSizes): string[] {
  const placed = new Set(layout.map((item) => item.widget))
  return Object.keys(sizes).filter((widget) => !placed.has(widget))
}

// Copies the grid's positions onto the layout. Items the grid does not show
// (widgets that do not apply to the selected branch) keep their slot. Returns
// the same array when nothing moved, so a controlled grid settles.
export function applyPositions(
  layout: DashboardLayout,
  positions: readonly ({ i: string } & Box)[],
): DashboardLayout {
  const byId = new Map(positions.map((position) => [position.i, position]))
  let changed = false
  const next = layout.map((item) => {
    const position = byId.get(item.id)
    if (
      !position ||
      (position.x === item.x &&
        position.y === item.y &&
        position.w === item.w &&
        position.h === item.h)
    )
      return item
    changed = true
    return { ...item, x: position.x, y: position.y, w: position.w, h: position.h }
  })
  return changed ? next : layout
}

// Moves every item up, keeping its column, as far as the items above allow.
// For display only: the read-only page closes the rows left empty by widgets
// hidden at the branch, while the stored layout keeps their slots.
export function packUpward(layout: DashboardLayout): DashboardLayout {
  const packed: DashboardLayoutItem[] = []
  for (const item of readingOrder(layout)) {
    let y = item.y
    while (y > 0 && !packed.some((other) => collides({ ...item, y: y - 1 }, other))) y--
    packed.push(y === item.y ? item : { ...item, y })
  }
  return packed
}

// Top to bottom, then left to right: the order a single column shows.
export function readingOrder(layout: DashboardLayout): DashboardLayout {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x)
}

export function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  if (a.length !== b.length) return false
  const key = (item: DashboardLayoutItem) =>
    JSON.stringify([item.id, item.widget, item.x, item.y, item.w, item.h, item.options ?? null])
  const left = a.map(key).sort()
  const right = b.map(key).sort()
  return left.every((value, index) => value === right[index])
}
