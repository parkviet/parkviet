import { describe, expect, it } from 'vitest'
import type { KitchenBoard, KitchenTicket, KitchenTicketItem } from '../hooks/use-kitchen-board'
import {
  boardColumns,
  elapsedSeconds,
  lateness,
  matchesQuery,
  priorityCount,
  replaceTicket,
} from './kitchen-board'

const item = (id: string, patch: Partial<KitchenTicketItem> = {}): KitchenTicketItem => ({
  id,
  sale_line_id: null,
  name: id,
  modifiers: [],
  components: [],
  note: null,
  quantity: '1',
  status: 'new',
  started_at: null,
  ready_at: null,
  served_at: null,
  voided_at: null,
  recalled_at: null,
  recall_count: 0,
  prep_seconds: null,
  late: false,
  seat: null,
  course: null,
  priority: false,
  priority_at: null,
  ...patch,
})
const ticket = (id: string, items: KitchenTicketItem[], patch: Partial<KitchenTicket> = {}) =>
  ({
    id,
    workspace_id: `ws-${id}`,
    branch_id: 'b',
    kitchen_station_id: 's1',
    station_name: 'Bếp nóng',
    station_kind: 'prep',
    sequence: 1,
    kind: 'fire',
    service_mode: 'dine_in',
    business_date: '2026-11-20',
    header: { table: `Bàn ${id}`, order_number: `R${id}` },
    sent_at: '2026-11-20T10:00:00Z',
    done: false,
    done_at: null,
    priority: false,
    items,
    ...patch,
  }) as KitchenTicket
const board = (patch: Partial<KitchenBoard> = {}): KitchenBoard => ({
  branch_id: 'b',
  stations: [],
  service_mode: null,
  server_now: '2026-11-20T10:10:00Z',
  open: [],
  done: [],
  all_day: [],
  expo: [],
  ...patch,
})
const none = { showVoided: false, query: '', priorityOnly: false }

describe('boardColumns', () => {
  it('splits a ticket by item status, one card per ticket and column', () => {
    const columns = boardColumns(
      board({
        open: [
          ticket('1', [
            item('a'),
            item('b', { status: 'preparing' }),
            item('c', { status: 'ready' }),
          ]),
        ],
      }),
      none,
    )
    expect(columns.waiting.map((card) => card.items.map((row) => row.id))).toEqual([['a']])
    expect(columns.preparing.map((card) => card.items.map((row) => row.id))).toEqual([['b']])
    expect(columns.ready.map((card) => card.items.map((row) => row.id))).toEqual([['c']])
  })
  it('lists a ready dish once even though the pass repeats it', () => {
    const ready = item('c', { status: 'ready' })
    const columns = boardColumns(
      board({
        open: [ticket('1', [ready, item('a')])],
        expo: [
          {
            workspace_id: 'ws-1',
            header: null,
            service_mode: 'dine_in',
            ready_since: null,
            items: [{ item: ready, kitchen_ticket_id: '1', station_name: 'Bếp nóng' }],
          },
        ],
      }),
      none,
    )
    expect(columns.ready).toHaveLength(1)
    expect(columns.ready[0].items).toHaveLength(1)
  })
  it('shows a ready dish only the pass still knows about', () => {
    const columns = boardColumns(
      board({
        expo: [
          {
            workspace_id: 'ws-9',
            header: { table: 'Bàn 9' },
            service_mode: 'dine_in',
            ready_since: '2026-11-20T09:00:00Z',
            items: [
              { item: item('z', { status: 'ready' }), kitchen_ticket_id: '9', station_name: 'Bar' },
            ],
          },
        ],
      }),
      none,
    )
    expect(columns.ready[0]).toMatchObject({ id: '9', stationName: 'Bar', stationId: null })
  })
  it('puts urgent cards first and keeps the board order otherwise', () => {
    const columns = boardColumns(
      board({
        open: [
          ticket('1', [item('a')]),
          ticket('2', [item('b', { priority: true })]),
          ticket('3', [item('c')]),
        ],
      }),
      none,
    )
    expect(columns.waiting.map((card) => card.id)).toEqual(['2', '1', '3'])
    expect(columns.waiting[0].priority).toBe(true)
  })
  it('hides voided dishes unless asked, and files them by how far they got', () => {
    const open = [
      ticket('1', [
        item('a'),
        item('v1', { status: 'voided' }),
        item('v2', { status: 'voided', started_at: '2026-11-20T10:01:00Z' }),
      ]),
    ]
    expect(boardColumns(board({ open }), none).preparing).toHaveLength(0)
    const shown = boardColumns(board({ open }), { ...none, showVoided: true })
    expect(shown.waiting[0].items.map((row) => row.id)).toEqual(['a', 'v1'])
    expect(shown.preparing[0].items.map((row) => row.id)).toEqual(['v2'])
  })
  it('keeps only urgent dishes in the urgent filter', () => {
    const columns = boardColumns(
      board({ open: [ticket('1', [item('a'), item('b', { priority: true })])] }),
      { ...none, priorityOnly: true },
    )
    expect(columns.waiting[0].items.map((row) => row.id)).toEqual(['b'])
  })
  it('ignores void tickets and applies the search', () => {
    const columns = boardColumns(
      board({
        open: [
          ticket('1', [item('Phở bò')]),
          ticket('2', [item('Cơm')]),
          ticket('3', [item('x')], { kind: 'void' }),
        ],
      }),
      { ...none, query: 'pho' },
    )
    expect(columns.waiting.map((card) => card.id)).toEqual(['1'])
  })
})

describe('matchesQuery', () => {
  const card = {
    header: { table: 'Bàn Đào', order_number: 'R-0042' },
    items: [item('Bún chả', { modifiers: [{ name: 'Thêm chả', quantity: 1 }] })],
  }
  it('ignores accents and case in dish, table and order number', () => {
    expect(matchesQuery(card, 'BUN CHA')).toBe(true)
    expect(matchesQuery(card, 'dao')).toBe(true)
    expect(matchesQuery(card, 'r-0042')).toBe(true)
    expect(matchesQuery(card, 'them cha')).toBe(true)
    expect(matchesQuery(card, 'lau')).toBe(false)
    expect(matchesQuery(card, '  ')).toBe(true)
  })
})

describe('lateness', () => {
  const station = { warn_after_minutes: 5, late_after_minutes: 10 }
  const clock = { serverNow: '2026-11-20T10:10:00Z', receivedAt: 1_000 }
  it('counts from the server clock, not the machine date', () => {
    expect(lateness('2026-11-20T10:07:00Z', station, clock, 1_000)).toBe('ok')
    expect(lateness('2026-11-20T10:04:00Z', station, clock, 1_000)).toBe('warn')
    expect(lateness('2026-11-20T10:00:00Z', station, clock, 1_000)).toBe('late')
  })
  it('keeps counting after the read', () => {
    expect(lateness('2026-11-20T10:07:00Z', station, clock, 1_000 + 3 * 60_000)).toBe('warn')
  })
  it('is ok without a station or a sent time', () => {
    expect(lateness(null, station, clock, 0)).toBe('ok')
    expect(lateness('2026-11-20T09:00:00Z', null, clock, 0)).toBe('ok')
  })
  it('counts elapsed seconds', () => {
    expect(elapsedSeconds('2026-11-20T10:09:00Z', clock, 1_000 + 5_000)).toBe(65)
    expect(elapsedSeconds(null, clock, 0)).toBe(0)
  })
})

describe('priorityCount and replaceTicket', () => {
  it('counts urgent dishes still to make', () => {
    expect(
      priorityCount(
        board({
          open: [
            ticket('1', [
              item('a', { priority: true }),
              item('b', { priority: true, status: 'ready' }),
            ]),
          ],
        }),
      ),
    ).toBe(1)
    expect(priorityCount(undefined)).toBe(0)
  })
  it('swaps a returned ticket into its list', () => {
    const next = ticket('1', [item('a', { priority: true })])
    const result = replaceTicket(board({ open: [ticket('1', [item('a')]), ticket('2', [])] }), next)
    expect(result.open[0]).toBe(next)
    expect(result.open).toHaveLength(2)
  })
})
