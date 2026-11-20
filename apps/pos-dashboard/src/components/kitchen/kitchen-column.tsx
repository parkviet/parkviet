import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { KitchenColumnKey } from '../../lib/kitchen-board'

// One column of the board. It scrolls on its own, so a long column never
// pushes the others out of view.
export function KitchenColumn({
  column,
  count,
  active,
  children,
}: {
  column: KitchenColumnKey
  count: number
  // Narrow screens show one column at a time.
  active: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const heading = `kitchen-column-${column}`
  return (
    <section
      aria-labelledby={heading}
      className={`${active ? 'flex' : 'hidden md:flex'} min-w-0 flex-col gap-3 rounded-lg bg-muted/40 p-3`}
    >
      <h3 id={heading} className="flex items-center justify-between text-sm font-medium">
        {t(`kitchenBoard.column_${column}`)}
        <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums">{count}</span>
      </h3>
      <div className="flex max-h-[calc(100dvh-20rem)] min-h-40 flex-col gap-3 overflow-y-auto">
        {count === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('kitchenBoard.emptyColumn')}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
