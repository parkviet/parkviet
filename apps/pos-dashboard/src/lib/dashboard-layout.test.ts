import { describe, expect, it } from 'vitest'
import {
  applyPositions,
  clampItem,
  type DashboardLayout,
  defaultLayout,
  firstFreeSpot,
  MAX_LAYOUT_ITEMS,
  mergeLayout,
  missingWidgets,
  packUpward,
  placeWidget,
  readingOrder,
  sameLayout,
  type WidgetSizes,
} from './dashboard-layout'

const card = { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 4 }
const wide = { w: 8, h: 7, minW: 5, minH: 5, maxW: 8, maxH: 8 }
const sizes: WidgetSizes = { funds: card, credit: card, cash: card, trend: wide }

describe('home widget layout', () => {
  it('packs the default layout left to right, then down', () => {
    expect(defaultLayout(sizes)).toEqual([
      { id: 'funds', widget: 'funds', x: 0, y: 0, w: 4, h: 3 },
      { id: 'credit', widget: 'credit', x: 4, y: 0, w: 4, h: 3 },
      { id: 'cash', widget: 'cash', x: 8, y: 0, w: 4, h: 3 },
      { id: 'trend', widget: 'trend', x: 0, y: 3, w: 8, h: 7 },
    ])
  })

  it('finds the top-most then left-most free spot', () => {
    expect(firstFreeSpot([], 4, 3)).toEqual({ x: 0, y: 0 })
    expect(firstFreeSpot([{ x: 0, y: 0, w: 4, h: 3 }], 4, 3)).toEqual({ x: 4, y: 0 })
    // A hole left by a removed widget is reused before the bottom.
    const holed = [
      { x: 0, y: 0, w: 4, h: 3 },
      { x: 8, y: 0, w: 4, h: 3 },
      { x: 0, y: 3, w: 12, h: 2 },
    ]
    expect(firstFreeSpot(holed, 4, 3)).toEqual({ x: 4, y: 0 })
    // Too wide for the hole: below everything.
    expect(firstFreeSpot(holed, 5, 3)).toEqual({ x: 0, y: 5 })
    // Wider than the grid is placed at full width.
    expect(firstFreeSpot([], 20, 1)).toEqual({ x: 0, y: 0 })
  })

  it('adds a widget at its default size and keeps ids unique', () => {
    const one = placeWidget([], 'funds', card)
    const two = placeWidget(one, 'funds', card)
    expect(two.map((item) => item.id)).toEqual(['funds', 'funds-2'])
    expect(two[1]).toMatchObject({ x: 4, y: 0, w: 4, h: 3 })
  })

  it('clamps an item into its size limits and the grid', () => {
    expect(clampItem({ id: 'a', widget: 'a', x: 11.4, y: -2, w: 1, h: 9 }, card)).toEqual({
      id: 'a',
      widget: 'a',
      x: 9,
      y: 0,
      w: 3,
      h: 4,
    })
    expect(clampItem({ id: 'a', widget: 'a', x: 0, y: 0, w: 12, h: 3 }, card).w).toBe(6)
  })

  it('merges a stored layout with the widgets the page knows', () => {
    const stored = [
      { id: 'funds', widget: 'funds', x: 2, y: 1, w: 10, h: 1, options: { tab: 'orders' } },
      { id: 'gone', widget: 'removed-widget', x: 0, y: 0, w: 4, h: 3 },
      { id: 'funds', widget: 'credit', x: 0, y: 0, w: 4, h: 3 },
      { id: 'cash', widget: 'cash', x: '1', y: 0, w: 4, h: 3 },
      { id: 'trend', widget: 'trend', x: 0, y: 4, w: 8, h: 7, options: 'bad' },
      null,
    ]
    expect(mergeLayout(stored, sizes)).toEqual([
      { id: 'funds', widget: 'funds', x: 2, y: 1, w: 6, h: 2, options: { tab: 'orders' } },
      { id: 'trend', widget: 'trend', x: 0, y: 4, w: 8, h: 7 },
    ])
  })

  it('treats anything but an array as no stored layout', () => {
    expect(mergeLayout(null, sizes)).toBeNull()
    expect(mergeLayout({ funds: 1 }, sizes)).toBeNull()
    expect(mergeLayout([], sizes)).toEqual([])
  })

  it('ignores entries past the layout limit', () => {
    const many = Array.from({ length: MAX_LAYOUT_ITEMS + 5 }, (_, n) => ({
      id: `funds-${n}`,
      widget: 'funds',
      x: 0,
      y: n * 3,
      w: 4,
      h: 3,
    }))
    expect(mergeLayout(many, sizes)).toHaveLength(MAX_LAYOUT_ITEMS)
  })

  it('lists registry widgets not on the page in registry order', () => {
    expect(missingWidgets(placeWidget([], 'cash', card), sizes)).toEqual([
      'funds',
      'credit',
      'trend',
    ])
  })

  it('copies grid positions and keeps the slot of widgets the grid did not show', () => {
    const layout = defaultLayout(sizes)
    const next = applyPositions(layout, [{ i: 'credit', x: 0, y: 3, w: 6, h: 3 }])
    expect(next.find((item) => item.id === 'credit')).toMatchObject({ x: 0, y: 3, w: 6, h: 3 })
    expect(next.find((item) => item.id === 'trend')).toEqual(layout[3])
    const unchanged = layout.map(({ id, x, y, w, h }) => ({ i: id, x, y, w, h }))
    expect(applyPositions(layout, unchanged)).toBe(layout)
  })

  it('orders a single column top to bottom, then left to right', () => {
    const layout: DashboardLayout = [
      { id: 'b', widget: 'b', x: 4, y: 0, w: 4, h: 3 },
      { id: 'c', widget: 'c', x: 0, y: 3, w: 4, h: 3 },
      { id: 'a', widget: 'a', x: 0, y: 0, w: 4, h: 3 },
    ]
    expect(readingOrder(layout).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('compares layouts regardless of item order', () => {
    const layout = defaultLayout(sizes)
    expect(sameLayout(layout, [...layout].reverse())).toBe(true)
    expect(sameLayout(layout, layout.slice(1))).toBe(false)
    expect(
      sameLayout(layout, applyPositions(layout, [{ i: 'funds', x: 0, y: 0, w: 5, h: 3 }])),
    ).toBe(false)
  })

  it('pushes an item overlapping an earlier one down below it, keeping its column', () => {
    const stored = [
      { id: 'funds', widget: 'funds', x: 0, y: 0, w: 4, h: 3 },
      { id: 'credit', widget: 'credit', x: 0, y: 0, w: 4, h: 3 },
      { id: 'cash', widget: 'cash', x: 2, y: 1, w: 4, h: 3 },
    ]
    expect(mergeLayout(stored, sizes)).toEqual([
      { id: 'funds', widget: 'funds', x: 0, y: 0, w: 4, h: 3 },
      { id: 'credit', widget: 'credit', x: 0, y: 3, w: 4, h: 3 },
      { id: 'cash', widget: 'cash', x: 2, y: 6, w: 4, h: 3 },
    ])
  })

  it('keeps the slot of a widget hidden at the branch when the others move', () => {
    // `credit` does not apply at the selected branch: the grid shows the rest.
    const layout = defaultLayout(sizes)
    const credit = layout.find((item) => item.id === 'credit')
    const moved = applyPositions(layout, [
      { i: 'funds', x: 0, y: 3, w: 4, h: 3 },
      { i: 'cash', x: 8, y: 0, w: 4, h: 3 },
      { i: 'trend', x: 0, y: 6, w: 8, h: 7 },
    ])
    const reloaded = mergeLayout(JSON.parse(JSON.stringify(moved)), sizes)
    expect(reloaded?.find((item) => item.id === 'credit')).toEqual(credit)
    expect(reloaded?.find((item) => item.id === 'funds')).toMatchObject({ x: 0, y: 3 })
    // A widget added later does not land on the hidden slot at x 4.
    const once = placeWidget(
      reloaded!.filter((item) => item.id !== 'funds'),
      'funds',
      card,
    )
    expect(once.at(-1)).toMatchObject({ x: 0, y: 0 })
    expect(placeWidget(once, 'funds', card).at(-1)).toMatchObject({ x: 0, y: 3 })
  })

  it('packs the shown widgets upward for display without changing the layout', () => {
    // Only `cash` (8,3) and `trend` (0,10) are shown at the branch.
    const stored: DashboardLayout = [
      { id: 'funds', widget: 'funds', x: 0, y: 0, w: 4, h: 3 },
      { id: 'cash', widget: 'cash', x: 8, y: 3, w: 4, h: 3 },
      { id: 'trend', widget: 'trend', x: 0, y: 10, w: 8, h: 7 },
    ]
    const snapshot = structuredClone(stored)
    const shown = stored.filter((item) => item.id !== 'funds')
    expect(packUpward(shown)).toEqual([
      { id: 'cash', widget: 'cash', x: 8, y: 0, w: 4, h: 3 },
      { id: 'trend', widget: 'trend', x: 0, y: 0, w: 8, h: 7 },
    ])
    expect(stored).toEqual(snapshot)
    // A widget below another stops under it.
    expect(
      packUpward([
        { id: 'a', widget: 'a', x: 0, y: 2, w: 6, h: 3 },
        { id: 'b', widget: 'b', x: 3, y: 9, w: 6, h: 2 },
      ]).map((item) => item.y),
    ).toEqual([0, 3])
  })
})
