import type {
  KitchenBoard,
  KitchenTicket,
  KitchenTicketHeader,
  KitchenTicketItem,
} from '../hooks/use-kitchen-board'

export type KitchenColumnKey = 'waiting' | 'preparing' | 'ready'
export const KITCHEN_COLUMNS: readonly KitchenColumnKey[] = ['waiting', 'preparing', 'ready']

// One ticket as one column shows it: only the items that belong to the column.
export type KitchenCard = {
  id: string
  header: KitchenTicketHeader | null
  serviceMode: string
  stationId: string | null
  stationName: string
  sentAt: string | null
  // An item still to make in this card is marked urgent.
  priority: boolean
  items: KitchenTicketItem[]
}

export type BoardFilter = { showVoided: boolean; query: string; priorityOnly: boolean }

const isOpen = (item: KitchenTicketItem) => item.status === 'new' || item.status === 'preparing'

// Voided dishes stay where the kitchen had them: with the ones being made if
// they were started, else with the ones waiting.
function columnOf(item: KitchenTicketItem, showVoided: boolean): KitchenColumnKey | null {
  if (item.status === 'new') return 'waiting'
  if (item.status === 'preparing') return 'preparing'
  if (item.status === 'ready') return 'ready'
  if (item.status === 'voided' && showVoided) return item.started_at ? 'preparing' : 'waiting'
  return null
}

// The text the search box compares: no accents, no case.
export function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim()
}

// What a header calls the order: the table, else the pickup code, else the order number.
export function headerTitle(header: KitchenTicketHeader | null | undefined) {
  return (
    header?.table ||
    header?.pickup_code ||
    header?.order_number ||
    header?.guest_name ||
    header?.customer_name ||
    ''
  )
}

// A card matches when the query is in its table, call number, order number or
// guest, or in the name of one of its dishes.
export function matchesQuery(card: Pick<KitchenCard, 'header' | 'items'>, query: string) {
  const needle = normalizeText(query)
  if (!needle) return true
  const header = Object.values(card.header ?? {}).filter(
    (value): value is string => typeof value === 'string',
  )
  const names = card.items.flatMap((item) => [item.name, ...item.modifiers.map((row) => row.name)])
  return [...header, ...names].some((text) => normalizeText(text).includes(needle))
}

export type ServerClock = { serverNow: string; receivedAt: number }
export type Lateness = 'ok' | 'warn' | 'late'

// How overdue a ticket is against its station's thresholds. The server's clock
// is the reference: the wait is counted from the server time of the last read,
// carried forward by the time passed here since.
export function lateness(
  sentAt: string | null,
  station: { warn_after_minutes: number; late_after_minutes: number } | null | undefined,
  clock: ServerClock,
  now: number,
): Lateness {
  if (!sentAt || !station) return 'ok'
  const sent = Date.parse(sentAt)
  const server = Date.parse(clock.serverNow)
  if (Number.isNaN(sent) || Number.isNaN(server)) return 'ok'
  const minutes = (now - clock.receivedAt + server - sent) / 60_000
  if (minutes >= station.late_after_minutes) return 'late'
  if (minutes >= station.warn_after_minutes) return 'warn'
  return 'ok'
}

// Whole seconds since a time, on the server's clock.
export function elapsedSeconds(since: string | null, clock: ServerClock, now: number) {
  const start = since ? Date.parse(since) : Number.NaN
  const server = Date.parse(clock.serverNow)
  if (Number.isNaN(start) || Number.isNaN(server)) return 0
  return Math.max(0, Math.floor((now - clock.receivedAt + server - start) / 1000))
}

type Slot = { card: KitchenCard; ticketId: string }

// The three columns, each a list of cards (urgent ones first, then the board's
// own order). A dish counts once: ready ones come from the tickets and from the
// pass, which lists them again.
export function boardColumns(
  board: KitchenBoard,
  { showVoided, query, priorityOnly }: BoardFilter,
): Record<KitchenColumnKey, KitchenCard[]> {
  const columns: Record<KitchenColumnKey, Slot[]> = { waiting: [], preparing: [], ready: [] }
  const seen = new Set<string>()
  const slot = (column: KitchenColumnKey, ticketId: string, make: () => KitchenCard) => {
    const found = columns[column].find((entry) => entry.ticketId === ticketId)
    if (found) return found.card
    const card = make()
    columns[column].push({ card, ticketId })
    return card
  }
  const take = (item: KitchenTicketItem) => {
    if (seen.has(item.id)) return null
    const column = columnOf(item, showVoided)
    if (!column || (priorityOnly && !item.priority)) return null
    seen.add(item.id)
    return column
  }

  for (const ticket of [...board.open, ...board.done]) {
    if (ticket.kind === 'void') continue
    for (const item of ticket.items) {
      const column = take(item)
      if (column) slot(column, ticket.id, () => cardOf(ticket)).items.push(item)
    }
  }
  for (const order of board.expo) {
    for (const row of order.items) {
      const column = take(row.item)
      if (column)
        slot(column, row.kitchen_ticket_id, () => ({
          id: row.kitchen_ticket_id,
          header: order.header,
          serviceMode: order.service_mode,
          stationId: null,
          stationName: row.station_name,
          sentAt: order.ready_since,
          priority: false,
          items: [],
        })).items.push(row.item)
    }
  }

  const result = { waiting: [], preparing: [], ready: [] } as Record<
    KitchenColumnKey,
    KitchenCard[]
  >
  for (const key of KITCHEN_COLUMNS) {
    const cards = columns[key]
      .map(({ card }) => ({
        ...card,
        priority: card.items.some((item) => item.priority && isOpen(item)),
      }))
      .filter((card) => matchesQuery(card, query))
    result[key] = [
      ...cards.filter((card) => card.priority),
      ...cards.filter((card) => !card.priority),
    ]
  }
  return result
}

function cardOf(ticket: KitchenTicket): KitchenCard {
  return {
    id: ticket.id,
    header: ticket.header,
    serviceMode: ticket.service_mode,
    stationId: ticket.kitchen_station_id,
    stationName: ticket.station_name,
    sentAt: ticket.sent_at,
    priority: false,
    items: [],
  }
}

// Dishes still to make that are marked urgent, across the open tickets.
export function priorityCount(board: KitchenBoard | undefined) {
  if (!board) return 0
  return board.open.reduce(
    (sum, ticket) =>
      ticket.kind === 'void'
        ? sum
        : sum + ticket.items.filter((item) => item.priority && isOpen(item)).length,
    0,
  )
}

// Swaps a ticket the server returned into a board, so the screen moves before
// the next read.
export function replaceTicket(board: KitchenBoard, ticket: KitchenTicket): KitchenBoard {
  const swap = (rows: KitchenTicket[]) => rows.map((row) => (row.id === ticket.id ? ticket : row))
  return { ...board, open: swap(board.open), done: swap(board.done) }
}
