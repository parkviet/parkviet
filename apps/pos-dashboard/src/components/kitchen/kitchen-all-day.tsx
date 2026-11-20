import { Badge, Button } from '@spree/dashboard-ui'
import { CheckIcon } from '@spree/dashboard-ui/icons'
import { useTranslation } from 'react-i18next'
import type { KitchenAllDayRow } from '../../hooks/use-kitchen-board'
import { elapsedSeconds, type ServerClock } from '../../lib/kitchen-board'
import { formatWait } from './kitchen-ticket-card'

// The open items added up by dish: how many of each are still to make, and a
// button that finishes the oldest one.
export function KitchenAllDay({
  rows,
  clock,
  now,
  busy,
  onBump,
}: {
  rows: KitchenAllDayRow[]
  clock: ServerClock
  now: number
  busy: ReadonlySet<string>
  onBump: (row: KitchenAllDayRow) => void
}) {
  const { t } = useTranslation()
  if (rows.length === 0)
    return (
      <p className="py-10 text-center text-muted-foreground">{t('kitchenBoard.emptyDishes')}</p>
    )
  return (
    <ul className="divide-y rounded-lg border bg-card" aria-label={t('kitchenBoard.viewDishes')}>
      {rows.map((row) => (
        <li key={row.key} className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span>{row.name}</span>
              {row.priority && <Badge variant="default">{t('kitchenBoard.priority')}</Badge>}
            </p>
            {row.modifiers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {row.modifiers.map((modifier) => modifier.name).join(', ')}
              </p>
            )}
            <p className="text-xs tabular-nums text-muted-foreground">
              {t('kitchenBoard.oldest', {
                time: formatWait(elapsedSeconds(row.oldest_sent_at, clock, now)),
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xl font-semibold tabular-nums">{row.quantity}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy.has(row.key)}
              onClick={() => onBump(row)}
            >
              <CheckIcon />
              {t('kitchenBoard.bumpOne')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
