import { Badge, Button } from '@spree/dashboard-ui'
import { CheckIcon, PlayIcon, RotateCcwIcon, StarIcon } from '@spree/dashboard-ui/icons'
import { useTranslation } from 'react-i18next'
import type { KitchenItemAction, KitchenTicketItem } from '../../hooks/use-kitchen-board'
import {
  elapsedSeconds,
  headerTitle,
  type KitchenCard,
  type KitchenColumnKey,
  type Lateness,
  type ServerClock,
} from '../../lib/kitchen-board'

export type KitchenCardActions = {
  item: (item: KitchenTicketItem, action: KitchenItemAction) => void
  bump: (card: KitchenCard) => void
  priority: (target: 'item' | 'ticket', id: string, priority: boolean) => void
}

const ITEM_ACTION: Record<KitchenColumnKey, { action: KitchenItemAction; label: string }> = {
  waiting: { action: 'start', label: 'kitchenBoard.start' },
  preparing: { action: 'ready', label: 'kitchenBoard.done' },
  ready: { action: 'serve', label: 'kitchenBoard.served' },
}

export function formatWait(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}`
    : `${minutes}:${rest}`
}

const TONE: Record<Lateness, string> = {
  ok: '',
  warn: 'border-warning-border bg-warning-bg',
  late: 'border-destructive',
}

export function KitchenTicketCard({
  card,
  column,
  lateness,
  clock,
  now,
  busy,
  actions,
}: {
  card: KitchenCard
  column: KitchenColumnKey
  lateness: Lateness
  clock: ServerClock
  now: number
  busy: ReadonlySet<string>
  actions: KitchenCardActions
}) {
  const { t } = useTranslation()
  const title = headerTitle(card.header) || t('kitchenBoard.noTitle')
  const making = column !== 'ready'
  const open = card.items.filter((item) => item.status === 'new' || item.status === 'preparing')
  const ticketBusy = busy.has(card.id)
  const mode = card.serviceMode ? t(`branchKitchen.mode_${card.serviceMode}`, card.serviceMode) : ''
  return (
    <article
      aria-label={title}
      className={`space-y-2 rounded-lg border bg-card p-3 ${TONE[making ? lateness : 'ok']} ${
        card.priority ? 'ring-2 ring-primary' : ''
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{title}</span>
            {card.priority && <Badge variant="default">{t('kitchenBoard.priority')}</Badge>}
            {making && lateness === 'late' && (
              <Badge variant="destructive">{t('kitchenBoard.late')}</Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[mode, card.stationName, card.header?.order_number].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatWait(elapsedSeconds(card.sentAt, clock, now))}
          </span>
          {making && open.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-pressed={card.priority}
              aria-label={t(
                card.priority ? 'kitchenBoard.ticketPriorityOff' : 'kitchenBoard.ticketPriorityOn',
              )}
              title={t(
                card.priority ? 'kitchenBoard.ticketPriorityOff' : 'kitchenBoard.ticketPriorityOn',
              )}
              disabled={ticketBusy}
              onClick={() => actions.priority('ticket', card.id, !card.priority)}
            >
              <StarIcon className={card.priority ? 'fill-current' : ''} />
            </Button>
          )}
        </div>
      </header>
      {card.header?.note && (
        <p className="text-xs italic text-muted-foreground">{card.header.note}</p>
      )}
      <ul className="space-y-2">
        {card.items.map((item) => (
          <KitchenItemRow
            key={item.id}
            item={item}
            column={column}
            disabled={busy.has(item.id) || ticketBusy}
            actions={actions}
          />
        ))}
      </ul>
      {making && open.length > 1 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={ticketBusy}
          onClick={() => actions.bump(card)}
        >
          <CheckIcon />
          {t('kitchenBoard.bumpAll')}
        </Button>
      )}
    </article>
  )
}

function KitchenItemRow({
  item,
  column,
  disabled,
  actions,
}: {
  item: KitchenTicketItem
  column: KitchenColumnKey
  disabled: boolean
  actions: KitchenCardActions
}) {
  const { t } = useTranslation()
  const voided = item.status === 'voided'
  const isOpen = item.status === 'new' || item.status === 'preparing'
  const step = ITEM_ACTION[column]
  return (
    <li className="flex items-start justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0">
      <div className={`min-w-0 text-sm ${voided ? 'text-muted-foreground line-through' : ''}`}>
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-medium">
            {item.quantity}× {item.name}
          </span>
          {item.priority && isOpen && <StarIcon className="size-3.5 fill-current text-primary" />}
          {voided && <Badge variant="outline">{t('kitchenBoard.voided')}</Badge>}
          {item.recall_count > 0 && !voided && (
            <Badge variant="warning">
              {t('kitchenBoard.recalled', { count: item.recall_count })}
            </Badge>
          )}
        </p>
        {item.modifiers.map((row) => (
          <p key={`${row.group_name ?? ''}-${row.name}`} className="text-xs text-muted-foreground">
            {row.quantity > 1 ? `${row.quantity}× ` : '+ '}
            {row.name}
          </p>
        ))}
        {item.components.map((row) => (
          <p key={row.name} className="text-xs text-muted-foreground">
            {row.quantity}× {row.name}
          </p>
        ))}
        {item.note && <p className="text-xs italic">{item.note}</p>}
        {(item.seat || item.course) && (
          <p className="text-xs text-muted-foreground">
            {[
              item.seat ? t('kitchenBoard.seat', { seat: item.seat }) : null,
              item.course ? t('kitchenBoard.course', { course: item.course }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      {!voided && (
        <div className="flex shrink-0 items-center gap-1">
          {isOpen && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-pressed={item.priority}
              aria-label={t(
                item.priority ? 'kitchenBoard.itemPriorityOff' : 'kitchenBoard.itemPriorityOn',
                {
                  name: item.name,
                },
              )}
              disabled={disabled}
              onClick={() => actions.priority('item', item.id, !item.priority)}
            >
              <StarIcon className={item.priority ? 'fill-current' : ''} />
            </Button>
          )}
          {column === 'ready' && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('kitchenBoard.recall')}
              title={t('kitchenBoard.recall')}
              disabled={disabled}
              onClick={() => actions.item(item, 'recall')}
            >
              <RotateCcwIcon />
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={column === 'waiting' ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => actions.item(item, step.action)}
          >
            {column === 'waiting' && <PlayIcon />}
            {t(step.label)}
          </Button>
        </div>
      )}
    </li>
  )
}
